// Personal AI Lab · Pages Functions API
// 路由: /api/*

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');

  // CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders(),
    });
  }

  try {
    // 公开路由
    if (request.method === 'POST' && path === 'auth/request-otp') {
      return handleRequestOTP(request, env);
    }
    if (request.method === 'POST' && path === 'auth/verify-otp') {
      return handleVerifyOTP(request, env);
    }

    // 需要认证的路由
    const user = await authUser(request, env);
    if (!user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (request.method === 'GET' && path === 'auth/me') {
      return json({ user: { id: user.id, email: user.email } });
    }
    if (request.method === 'POST' && path === 'auth/logout') {
      return json({ ok: true }, 200, { 'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
    }

    // 进度同步
    if (request.method === 'GET' && path === 'progress') {
      return handleGetProgress(user, env);
    }
    if (request.method === 'POST' && path === 'progress') {
      return handleSaveProgress(user, env, request);
    }
    if (request.method === 'POST' && path === 'progress/batch') {
      return handleBatchProgress(user, env, request);
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('API error:', e);
    return json({ error: e.message || 'Internal error' }, 500);
  }
}

// ── Helpers ──────────────────────────────────────────────

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

async function readBody(request) {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return request.json();
  }
  return {};
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 简单的 session token（签名用 env.SESSION_SECRET）
async function makeSession(userId, env) {
  const data = `${userId}:${now() + 30 * 24 * 3600}`; // 30 天
  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.SESSION_SECRET || 'dev-secret-change-me');
  const msgData = encoder.encode(data);
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, msgData);
  const sigHex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${data}:${sigHex}`;
}

async function verifySession(token, env) {
  if (!token) return null;
  const parts = token.split(':');
  if (parts.length !== 3) return null;
  const [userId, expires, sig] = parts;
  if (parseInt(expires) < now()) return null;

  const data = `${userId}:${expires}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(env.SESSION_SECRET || 'dev-secret-change-me');
  const msgData = encoder.encode(data);
  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const sigBytes = new Uint8Array(sig.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, msgData);
  if (!valid) return null;

  // 查用户
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(parseInt(userId)).first();
  return user;
}

async function authUser(request, env) {
  // 1. Cookie session
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (match) {
    const user = await verifySession(match[1], env);
    if (user) return user;
  }
  // 2. Bearer token
  const auth = request.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const user = await verifySession(auth.slice(7), env);
    if (user) return user;
  }
  return null;
}

// ── Auth: OTP ────────────────────────────────────────────

async function handleRequestOTP(request, env) {
  const { email } = await readBody(request);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email' }, 400);
  }

  const code = generateOTP();
  const t = now();

  // 保存 OTP
  await env.DB.prepare(
    'INSERT INTO otp_codes (email, code, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).bind(email, code, t + 600, t).run(); // 10 分钟有效

  // 清理过期的
  await env.DB.prepare('DELETE FROM otp_codes WHERE expires_at < ?').bind(t - 3600).run();

  // 发送邮件
  try {
    await sendOTPEmail(email, code, env);
  } catch (e) {
    console.error('Email send failed:', e);
    // 邮件发送失败也不告诉用户具体原因（安全），但日志里记录
    // 开发环境可以回退：在响应里返回 code（生产环境关掉）
    if (env.DEV_MODE === '1') {
      return json({ ok: true, dev_code: code });
    }
  }

  return json({ ok: true });
}

async function handleVerifyOTP(request, env) {
  const { email, code } = await readBody(request);
  if (!email || !code) {
    return json({ error: 'Missing email or code' }, 400);
  }

  const t = now();

  // 找有效 OTP
  const otp = await env.DB.prepare(
    'SELECT * FROM otp_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1'
  ).bind(email, code, t).first();

  if (!otp) {
    return json({ error: 'Invalid or expired code' }, 401);
  }

  // 标记已使用
  await env.DB.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otp.id).run();

  // 获取或创建用户
  let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user) {
    const result = await env.DB.prepare(
      'INSERT INTO users (email, created_at, last_login_at) VALUES (?, ?, ?)'
    ).bind(email, t, t).run();
    user = { id: result.meta.last_row_id, email, created_at: t, last_login_at: t };
  } else {
    await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(t, user.id).run();
  }

  // 生成 session
  const session = await makeSession(user.id, env);

  // 返回 + set cookie
  return json(
    { ok: true, user: { id: user.id, email: user.email }, token: session },
    200,
    {
      'Set-Cookie': `session=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`,
    }
  );
}

// ── Email sending ────────────────────────────────────────

async function sendOTPEmail(email, code, env) {
  if (env.EMAIL) {
    // Cloudflare Email Service binding
    await env.EMAIL.send({
      to: email,
      from: { email: 'no-reply@ailab-course.pages.dev', name: 'Personal AI Lab' },
      subject: `你的登录验证码：${code}`,
      text: `你的 Personal AI Lab 登录验证码是：${code}\n\n10 分钟内有效。如果你没有请求登录，请忽略这封邮件。`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:auto;padding:24px">
          <h2 style="margin:0 0 8px;font-size:20px">Personal AI Lab 登录验证码</h2>
          <p style="color:#666;margin:0 0 24px">用下面的验证码登录你的账号，10 分钟内有效。</p>
          <div style="background:#f5f5f5;border-radius:8px;padding:20px;text-align:center;font-size:36px;font-weight:800;letter-spacing:8px;font-family:ui-monospace,monospace">${code}</div>
          <p style="color:#999;font-size:13px;margin-top:24px">如果你没有请求登录，请忽略这封邮件。</p>
        </div>
      `,
    });
  } else {
    // 没有 email binding，打日志 + 抛错让上层处理
    console.log(`[DEV] OTP code for ${email}: ${code}`);
    throw new Error('Email service not configured');
  }
}

// ── Progress ─────────────────────────────────────────────

async function handleGetProgress(user, env) {
  const results = await env.DB.prepare(
    'SELECT module_id, task_id, completed, updated_at FROM progress WHERE user_id = ?'
  ).bind(user.id).all();

  return json({
    progress: results.results.map(r => ({
      module_id: r.module_id,
      task_id: r.task_id,
      completed: r.completed === 1,
      updated_at: r.updated_at,
    })),
  });
}

async function handleSaveProgress(user, env, request) {
  const body = await readBody(request);
  const { module_id, task_id, completed } = body;
  if (!module_id || !task_id) {
    return json({ error: 'Missing module_id or task_id' }, 400);
  }

  const t = now();
  const val = completed ? 1 : 0;

  await env.DB.prepare(`
    INSERT INTO progress (user_id, module_id, task_id, completed, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, module_id, task_id) DO UPDATE SET
      completed = excluded.completed,
      updated_at = excluded.updated_at
  `).bind(user.id, module_id, task_id, val, t).run();

  return json({ ok: true });
}

async function handleBatchProgress(user, env, request) {
  const body = await readBody(request);
  const items = body.items || [];
  const t = now();

  let count = 0;
  for (const item of items) {
    if (!item.module_id || !item.task_id) continue;
    const val = item.completed ? 1 : 0;
    await env.DB.prepare(`
      INSERT INTO progress (user_id, module_id, task_id, completed, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, module_id, task_id) DO UPDATE SET
        completed = excluded.completed,
        updated_at = excluded.updated_at
    `).bind(user.id, item.module_id, item.task_id, val, t).run();
    count++;
  }

  return json({ ok: true, synced: count });
}
