// Personal AI Lab · Auth + Sync 前端模块
// 邮箱 OTP 登录 + 进度云端同步

(function(){
  const API_BASE = '/api';

  // ── Auth ──────────────────────────────────────────────
  const Auth = {
    _token: null,
    _user: null,

    init() {
      // 从 localStorage 读取 token
      this._token = localStorage.getItem('pail_token');
      const userStr = localStorage.getItem('pail_user');
      if (userStr) {
        try { this._user = JSON.parse(userStr); } catch(e) {}
      }
      document.dispatchEvent(new Event('auth-ready'));
    },

    isLoggedIn() {
      return !!this._token && !!this._user;
    },

    getUser() {
      return this._user;
    },

    async requestOTP(email) {
      const res = await fetch(`${API_BASE}/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      return res.json();
    },

    async verifyOTP(email, code) {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (data.ok && data.token) {
        this._token = data.token;
        this._user = data.user;
        localStorage.setItem('pail_token', data.token);
        localStorage.setItem('pail_user', JSON.stringify(data.user));
        // 登录后把本地进度同步到云端
        this.syncLocalToRemote();
      }
      return data;
    },

    logout() {
      this._token = null;
      this._user = null;
      localStorage.removeItem('pail_token');
      localStorage.removeItem('pail_user');
      fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    },

    showLoginModal() {
      // 已存在就打开
      let modal = document.getElementById('login-modal');
      if (modal) {
        modal.classList.add('open');
        modal.querySelector('input[type=email]').focus();
        return;
      }

      modal = document.createElement('div');
      modal.id = 'login-modal';
      modal.className = 'login-modal';
      modal.innerHTML = `
        <div class="login-box">
          <h3>登录同步进度</h3>
          <p>用邮箱登录，换设备也不丢进度。</p>
          <div class="login-step" id="login-step-1">
            <input type="email" placeholder="输入邮箱地址" id="login-email">
            <button class="btn primary" id="send-otp-btn" style="width:100%">发送验证码</button>
          </div>
          <div class="login-step" id="login-step-2" style="display:none">
            <input type="text" placeholder="输入 6 位验证码" id="login-code" maxlength="6" style="letter-spacing:8px;text-align:center;font-size:24px;font-family:ui-monospace,monospace">
            <button class="btn primary" id="verify-otp-btn" style="width:100%">登录</button>
            <p style="text-align:center;margin:12px 0 0;font-size:12px;color:var(--muted)">
              <a href="#" id="resend-link" style="color:var(--muted)">重新发送验证码</a>
            </p>
          </div>
          <div class="hint">登录即表示同意保存你的学习进度。</div>
        </div>
      `;
      document.body.appendChild(modal);

      // 点击遮罩关闭
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('open');
      });

      let currentEmail = '';

      modal.querySelector('#send-otp-btn').addEventListener('click', async () => {
        const email = modal.querySelector('#login-email').value.trim();
        if (!email) return;
        currentEmail = email;
        const btn = modal.querySelector('#send-otp-btn');
        btn.textContent = '发送中…';
        btn.disabled = true;
        const res = await Auth.requestOTP(email);
        btn.disabled = false;
        if (res.ok) {
          modal.querySelector('#login-step-1').style.display = 'none';
          modal.querySelector('#login-step-2').style.display = 'block';
          modal.querySelector('#login-code').focus();
          // 开发模式显示验证码
          if (res.dev_code) {
            modal.querySelector('.hint').textContent = `[DEV] 验证码: ${res.dev_code}`;
          }
        } else {
          btn.textContent = res.error || '发送失败';
          setTimeout(() => btn.textContent = '发送验证码', 2000);
        }
      });

      modal.querySelector('#verify-otp-btn').addEventListener('click', async () => {
        const code = modal.querySelector('#login-code').value.trim();
        if (!code || code.length !== 6) return;
        const btn = modal.querySelector('#verify-otp-btn');
        btn.textContent = '验证中…';
        btn.disabled = true;
        const res = await Auth.verifyOTP(currentEmail, code);
        btn.disabled = false;
        if (res.ok) {
          modal.classList.remove('open');
          // 刷新页面同步进度
          location.reload();
        } else {
          btn.textContent = res.error || '验证失败';
          setTimeout(() => btn.textContent = '登录', 2000);
        }
      });

      // 回车提交
      modal.querySelector('#login-email').addEventListener('keydown', e => {
        if (e.key === 'Enter') modal.querySelector('#send-otp-btn').click();
      });
      modal.querySelector('#login-code').addEventListener('keydown', e => {
        if (e.key === 'Enter') modal.querySelector('#verify-otp-btn').click();
      });

      modal.querySelector('#resend-link').addEventListener('click', e => {
        e.preventDefault();
        modal.querySelector('#login-step-2').style.display = 'none';
        modal.querySelector('#login-step-1').style.display = 'block';
        modal.querySelector('#login-email').value = currentEmail;
        modal.querySelector('#login-email').focus();
      });

      modal.classList.add('open');
      setTimeout(() => modal.querySelector('#login-email').focus(), 100);
    },

    // ── Sync ──────────────────────────────────────────

    async saveProgress(moduleId, taskId, completed) {
      if (!this.isLoggedIn()) return;
      try {
        await fetch(`${API_BASE}/progress`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this._token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ module_id: moduleId, task_id: taskId, completed }),
        });
      } catch(e) {
        console.warn('Sync failed:', e);
      }
    },

    async loadAllProgress() {
      if (!this.isLoggedIn()) return [];
      try {
        const res = await fetch(`${API_BASE}/progress`, {
          headers: {
            'Authorization': `Bearer ${this._token}`,
          },
          credentials: 'include',
        });
        const data = await res.json();
        return data.progress || [];
      } catch(e) {
        console.warn('Load progress failed:', e);
        return [];
      }
    },

    async syncLocalToRemote() {
      // 把本地所有已完成的任务批量推到云端
      if (!this.isLoggedIn()) return;
      const items = [];
      const prefix = 'pail:';
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith(prefix)) continue;
        const val = localStorage.getItem(k) === '1';
        // 解析 module_id 和 task_id
        // key 格式: pail:m00.html:00-0
        const rest = k.slice(prefix.length);
        const [moduleHtml, taskId] = rest.split(':');
        const moduleId = moduleHtml.replace('.html', '');
        items.push({ module_id: moduleId, task_id: taskId, completed: val });
      }
      if (!items.length) return;
      try {
        await fetch(`${API_BASE}/progress/batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this._token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ items }),
        });
      } catch(e) {
        console.warn('Batch sync failed:', e);
      }
    },
  };

  Auth.init();
  window.Auth = Auth;
})();
