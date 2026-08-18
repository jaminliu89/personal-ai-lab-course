// ── Personal AI Lab Course · app.js ──────────────────────────
// 侧边栏动态注入 / 进度追踪 / 代码复制 / 术语高亮 / 搜索 / 键盘快捷键

// ── 课程元数据 ────────────────────────────────────────────
const COURSE = [
  { id:'m00', title:'先把"大模型训练"这件事看懂' },
  { id:'m01', title:'零基础 Python：只学训练模型真正会用到的部分' },
  { id:'m02', title:'终端、Git 与实验目录：让每次训练都可复现' },
  { id:'m03', title:'大模型第一性原理：Token 到下一个词' },
  { id:'m04', title:'第一次运行开源模型：把"网站里的 AI"变成你电脑里的模型' },
  { id:'m05', title:'Dataset Engineering：模型不是被"提示词"训练出来的，是被数据塑造的' },
  { id:'m06', title:'PyTorch：第一次亲眼看见"权重被更新"' },
  { id:'m07', title:'Transformer 与 Attention：从"会用"到"看懂模型结构"' },
  { id:'m08', title:'LoRA / QLoRA：第一次真正微调自己的模型' },
  { id:'m09', title:'Evaluation：不用"感觉更聪明了"判断模型' },
  { id:'m10', title:'专治"批量文件敷衍"：Deep Work Agent Pipeline' },
  { id:'m11', title:'DPO 与偏好数据：把"我喜欢这种答案"变成训练信号' },
  { id:'m12', title:'Continued Pretraining：让模型真正吸收领域语言分布' },
  { id:'m13', title:'从零训练 Mini GPT：把黑盒彻底拆开' },
  { id:'m14', title:'GPU、显存、量化与云训练：知道钱花在哪' },
  { id:'m15', title:'Model Serving：把模型变成你自己的 API' },
  { id:'m16', title:'Personal AI Lab OS：把学习升级成自己的模型公司' },
];

// ── 术语映射（正文中的术语自动链到术语表）──────────────────
const GLOSSARY = [
  'Base Model','Instruct Model','Token','Tokenizer','Context Window',
  'Parameter','Inference','Training','SFT','LoRA','QLoRA','Gradient',
  'Learning Rate','Epoch','Batch','Checkpoint','Eval','DPO','RAG',
  'Agent','Quantization','Attention','QKV','Transformer','PyTorch',
  'Tensor','Embedding','Causal Mask','Adapter','Benchmark','Dataset',
  'Fine-tuning','Pretraining','MLP','Residual','Optimizer','Loss',
  'Forward','Backward','Backpropagation','Activation','Logits','Softmax',
  'Overfitting','Generalization','Cross-validation','Test Set','Validation Set',
  'Train Set','Data Augmentation','Deduplication','JSONL','Chat Template',
  'Model Serving','GPU','VRAM','显存','推理','训练','微调','预训练',
];

// ── Storage 层 ────────────────────────────────────────────
const Store = {
  prefix: 'pail:',
  getTask(moduleId, taskId) {
    return localStorage.getItem(this.prefix + moduleId + '.html:' + taskId) === '1';
  },
  setTask(moduleId, taskId, val) {
    const key = this.prefix + moduleId + '.html:' + taskId;
    if (val) localStorage.setItem(key, '1');
    else localStorage.removeItem(key);
  },
  getModuleProgress(moduleId) {
    const boxes = document.querySelectorAll(`input[data-task][data-module="${moduleId}"]`);
    if (!boxes.length) return { total: 0, done: 0, pct: 0 };
    const done = [...boxes].filter(b => b.checked).length;
    return { total: boxes.length, done, pct: Math.round(done / boxes.length * 100) };
  },
  getAllProgress() {
    const result = {};
    for (const m of COURSE) {
      // 从本地存储里数
      const keys = Object.keys(localStorage).filter(k =>
        k.startsWith(this.prefix + m.id + '.html:')
      );
      // 但我们不知道总任务数，所以从 DOM 或已知数据算
      result[m.id] = { keys: keys.length };
    }
    return result;
  },
  exportAll() {
    const data = {};
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(this.prefix)) data[k] = localStorage.getItem(k);
    }
    return data;
  },
  importAll(data) {
    let count = 0;
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith(this.prefix)) {
        localStorage.setItem(k, v);
        count++;
      }
    }
    return count;
  }
};

// ── 侧边栏注入 ────────────────────────────────────────────
function injectSidebar() {
  const aside = document.querySelector('aside.side');
  if (!aside) return;
  const path = location.pathname.split('/').pop() || 'index.html';
  const currentId = path.replace('.html', '');

  let html = '<div class="eyebrow">COURSE MAP</div>';
  html += `<a href="index.html" class="${path==='index.html'?'current':''}">← 首页</a>`;
  for (const m of COURSE) {
    const isCurrent = m.id === currentId;
    const pct = getLocalModuleProgress(m.id);
    html += `
      <a href="${m.id}.html" class="${isCurrent?'current':''}" data-nav="${m.id}">
        <span class="nav-num">${m.id.replace('m','')}</span>
        <span class="nav-title">${m.title}</span>
        <span class="nav-pct">${pct}%</span>
      </a>`;
  }
  html += '<div class="side-foot">';
  html += `<div class="total-progress">整体进度 <b data-total-pct>0%</b></div>`;
  html += '<div class="progressbar"><i></i></div>';
  html += '</div>';
  aside.innerHTML = html;
  updateTotalProgress();
}

function getLocalModuleProgress(moduleId) {
  // 数这个模块已完成的任务数（从 localStorage）
  const prefix = Store.prefix + moduleId + '.html:';
  let done = 0;
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(prefix) && localStorage.getItem(k) === '1') done++;
  }
  // 总任务数需要从 DOM 或缓存里拿
  const total = MODULE_TASK_COUNT[moduleId] || 0;
  if (!total) return 0;
  return Math.round(done / total * 100);
}

// 预定义每课任务数（从页面扫描得出）
const MODULE_TASK_COUNT = {
  m00:4, m01:5, m02:4, m03:3, m04:4, m05:5, m06:4, m07:4, m08:6,
  m09:5, m10:6, m11:5, m12:5, m13:8, m14:4, m15:5, m16:5,
};

function updateTotalProgress() {
  let totalTasks = 0, doneTasks = 0;
  for (const [mid, count] of Object.entries(MODULE_TASK_COUNT)) {
    totalTasks += count;
    const prefix = Store.prefix + mid + '.html:';
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(prefix) && localStorage.getItem(k) === '1') doneTasks++;
    }
  }
  const pct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;
  document.querySelectorAll('[data-total-pct]').forEach(e => e.textContent = pct + '%');
  document.querySelectorAll('.side-foot .progressbar i').forEach(e => e.style.width = pct + '%');
}

// ── 任务勾选 ──────────────────────────────────────────────
function initTasks() {
  const path = location.pathname.split('/').pop() || '';
  const moduleId = path.replace('.html', '');
  const boxes = [...document.querySelectorAll('input[data-task]')];
  boxes.forEach(b => {
    const taskId = b.dataset.task;
    b.checked = Store.getTask(moduleId, taskId);
    // 加上 module 标识
    b.dataset.module = moduleId;
    b.addEventListener('change', () => {
      Store.setTask(moduleId, taskId, b.checked);
      updateProgress();
      updateTotalProgress();
      updateNavProgress();
      // 同步到云端（如果已登录）
      if (window.Auth && Auth.isLoggedIn()) {
        Sync.pushOne(moduleId, taskId, b.checked);
      }
    });
  });
  updateProgress();
}

function updateProgress() {
  const boxes = document.querySelectorAll('input[data-task]');
  if (!boxes.length) return;
  const n = [...boxes].filter(x => x.checked).length;
  const p = Math.round(n / boxes.length * 100);
  document.querySelectorAll('[data-progress]').forEach(e => e.textContent = p + '%');
  document.querySelectorAll('.progressbar i').forEach(e => e.style.width = p + '%');
}

function updateNavProgress() {
  // 更新侧边栏每个模块的百分比
  document.querySelectorAll('[data-nav]').forEach(a => {
    const mid = a.dataset.nav;
    const pct = getLocalModuleProgress(mid);
    const pctEl = a.querySelector('.nav-pct');
    if (pctEl) pctEl.textContent = pct + '%';
  });
}

// ── 代码块复制按钮 ────────────────────────────────────────
function initCopyButtons() {
  const blocks = document.querySelectorAll('pre code');
  blocks.forEach(code => {
    const pre = code.parentElement;
    pre.style.position = 'relative';
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '复制';
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.innerText);
        btn.textContent = '已复制';
        setTimeout(() => btn.textContent = '复制', 1500);
      } catch (e) {
        btn.textContent = '失败';
        setTimeout(() => btn.textContent = '复制', 1500);
      }
    });
    pre.appendChild(btn);
  });
}

// ── 术语自动高亮链接 ──────────────────────────────────────
function initGlossaryLinks() {
  // 只处理正文中的文本节点，避免破坏已有链接和代码
  const content = document.querySelector('.content');
  if (!content) return;

  // 按长度降序排列，避免短词先匹配
  const terms = [...GLOSSARY].sort((a, b) => b.length - a.length);

  function walk(node) {
    if (node.nodeType === 3) { // 文本节点
      let text = node.nodeValue;
      let replaced = false;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;

      for (const term of terms) {
        // 简单的词边界匹配（中文不需要空格边界）
        const idx = text.indexOf(term, lastIndex);
        if (idx >= 0) {
          // 检查是否在代码/链接里（父节点检查由外层保证）
          frag.appendChild(document.createTextNode(text.slice(lastIndex, idx)));
          const a = document.createElement('a');
          a.href = 'glossary.html#' + encodeURIComponent(term.toLowerCase());
          a.className = 'glossary-link';
          a.textContent = term;
          frag.appendChild(a);
          lastIndex = idx + term.length;
          replaced = true;
        }
      }
      if (replaced) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        node.parentNode.replaceChild(frag, node);
      }
    } else if (node.nodeType === 1) {
      // 跳过代码、链接、标题中的脚本等
      const tag = node.tagName.toLowerCase();
      if (['code', 'pre', 'a', 'script', 'style', 'h1', 'h2', 'h3'].includes(tag)) return;
      if (node.classList.contains('no-glossary')) return;
      // 倒序遍历，避免子节点被替换后索引错乱
      const children = [...node.childNodes];
      for (const child of children) {
        walk(child);
      }
    }
  }
  // 先只做 lesson 段落，避免过度匹配
  content.querySelectorAll('.lesson p, .errors li, .deliver p, .lead').forEach(el => {
    walk(el);
  });
}

// ── 术语页锚点跳转 ────────────────────────────────────────
function initGlossaryPage() {
  if (location.pathname.endsWith('glossary.html') && location.hash) {
    const term = decodeURIComponent(location.hash.slice(1)).toLowerCase();
    setTimeout(() => {
      const cards = document.querySelectorAll('.glossary .card h3, .grid .card h3');
      for (const h of cards) {
        if (h.textContent.toLowerCase() === term) {
          h.scrollIntoView({ behavior: 'smooth', block: 'center' });
          h.parentElement.style.outline = '2px solid var(--accent)';
          setTimeout(() => h.parentElement.style.outline = '', 2000);
          break;
        }
      }
    }, 100);
  }
}

// ── 常见错误展开 ──────────────────────────────────────────
const ERROR_EXPLANATIONS = {
  // 通用
  '训练前没有 baseline': '没有 base model 的同 prompt 输出做对照，训练后你根本不知道是变好了还是变差了。所有训练开始前必须用同一测试集跑一遍 base，保存结果。',
  '只看 loss 就宣布成功': 'loss 下降只代表模型记住了训练数据，不代表泛化能力或实际效果变好。过拟合的模型 loss 极低但完全不可用。必须用独立测试集做前后对比。',
  '没有保存模型与数据版本号': '三个月后你回来看到一个 adapter 文件，不知道它是用哪个 base model、哪个数据版本、什么参数训练出来的。每次实验必须保存完整的实验记录。',
  // m00
  '以为 "大模型 = 聊天机器人"': '聊天只是大模型的一种应用形态。它的本质是「给定上文预测下一个 token」的通用序列模型，可以做翻译、摘要、分类、生成代码等无数任务。',
  '把 RAG 当微调': 'RAG 是检索增强生成，只在推理时检索外部资料喂给模型，不修改模型权重。微调是真正改变模型参数。两者解决不同的问题，不要混淆。',
  // m01
  '一开始就系统学 Python': '90% 的人卡在这里。你不需要掌握整门语言，只需要能写训练脚本够用的子集。学太多用不上的语法只会消耗意志力。',
  '用 Anaconda / 图形界面装环境': '从一开始就用终端 + venv + pip，这是工业界标准做法，也是你后续跑训练的必备技能。',
  // m02
  '代码数据结果混在一个文件夹': '三周后你会分不清哪个文件是最新的、哪个结果对应哪次实验。建立清晰的目录结构从第一天开始。',
  '不写实验记录只留代码': '代码只告诉你"做了什么"，实验记录告诉你"为什么做、结果怎样、踩了什么坑"。后者才是真正的知识资产。',
  // m03
  '以为模型"理解"了文本': '模型只是在统计意义上预测下一个最可能的 token。它没有人类意义上的"理解"，但涌现出的能力往往惊人。',
  '把概率最大当唯一输出': '解码策略（temperature、top_p、top_k）会显著影响输出风格。理解这些参数比调 prompt 技巧更底层。',
  // m04
  '下载了模型但不知道怎么调用': '很多人卡在「模型文件躺在硬盘里，但跑不起来」。从 Ollama 或 transformers pipeline 起步，先跑通再优化。',
  '盲目追求最大的模型': '70B 模型你可能连加载都加载不了。从 1B-7B 的小模型起步，理解原理后再上大的。',
  // m05
  '数据质量差数量来凑': '100 条高质量数据 > 10000 条垃圾数据。SFT 阶段数据质量的权重远大于数量。',
  '不分训练/验证/测试集': '在训练集上测试等于作弊。必须有完全独立的测试集，且训练过程中也不能偷看。',
  '数据格式不一致': '有的样本是问答对、有的是散文、有的是代码片段。格式混乱会让模型学不到稳定的模式。统一的数据格式是第一原则。',
  // m06
  '跳过数学直接调 API': '你可以不手推梯度，但必须在直觉层面理解「参数变化 → loss 变化」的因果链。否则调参全靠瞎试。',
  '把 PyTorch 当黑盒': '至少要理解 tensor、forward、loss、backward、optimizer.step() 这五步的数据流。不需要懂底层实现。',
  // m07
  '背 QKV 公式但不懂为什么': 'Attention 的核心直觉是「每个 token 应该多看哪些其他 token」。公式是实现这个直觉的手段，不是目的。',
  '以为 Attention 是唯一机制': 'Transformer 里 Attention + MLP + 残差 + LayerNorm 缺一不可。理解它们各自的角色比只懂 Attention 重要。',
  // m08
  '把训练样本原封不动放进测试集': '这叫数据泄露。测试集必须完全独立，否则评测结果毫无意义。宁可测试集小，也不能污染。',
  'rank 设得越大越好': 'rank 越大参数越多，但不一定效果越好。rank=8/16 通常足够，rank=64 以上很容易过拟合。',
  '不对比 base 直接上 LoRA': '没有 baseline 你永远不知道 LoRA 到底有没有用。同一 prompt、同一 seed、同一参数，跑 base 和 tuned 对比。',
  // m09
  '用主观感受评估模型': '「感觉聪明了」「好像更流畅了」——这种评估毫无可重复性。必须有量化指标和固定测试集。',
  '评测集和训练集同源': '如果评测集跟训练集分布太像，你测的只是模型的记忆力而不是能力。评测集应该来自真实使用场景。',
  '只看平均分不看案例': '平均分数 80 分可能掩盖了某一类任务全部 0 分的问题。必须逐条分析失败案例。',
  // m10
  '把 Agent 当万能钥匙': 'Agent 不是什么都能干。它擅长需要多步骤推理和工具调用的任务，但简单任务直接调 API 更快更可靠。',
  '不做错误恢复设计': 'Agent 执行过程中任何一步都可能失败。没有重试、回退、人工介入机制的 Agent 流水线是脆弱的。',
  // m11
  '偏好数据随便标': 'DPO 的效果完全取决于偏好数据质量。「A 比 B 好」这个判断如果不一致、不清晰、没有统一标准，训练出来的模型会混乱。',
  '没有 SFT 直接上 DPO': 'DPO 需要模型已经有基本的指令遵循能力。先 SFT 对齐格式和基本行为，再用 DPO 打磨风格和偏好。',
  // m12
  '把 CPT 当 SFT 做': 'Continued Pretraining 学的是语言分布和领域知识，不是指令遵循。用问答对数据做 CPT 是浪费算力。',
  '学习率设太高': 'CPT 的学习率通常比 SFT 小一个数量级。太大的学习率会把预训练知识冲掉，出现灾难性遗忘。',
  // m13
  '把完整网络代码复制运行却逐行不懂': '复制粘贴一个能跑的 GPT 不等于你理解了 GPT。每行代码都要能说出它在做什么、为什么需要它。',
  'target 没右移': '预测第 i 个 token 只能看前 i-1 个。target 右移一位是最基础也是最容易忘的。',
  '忘 causal mask': '没有 causal mask，模型在训练时就能看到未来的 token，等于作弊。推理时会完全不对。',
  '只保存模型不保存 tokenizer 映射': '模型权重和 tokenizer 是绑定的。换了 tokenizer 或丢失了词汇映射，模型权重就废了。',
  // m14
  '显存不够就怪模型太大': '先试试量化、梯度检查点、更小的 batch size、LoRA。大多数情况下不是模型太大，是你没用对方法。',
  '云训练不看账单': 'GPU 按小时计费，忘关实例一天可能烧掉几百块。设置预算告警 + 自动停止脚本。',
  // m15
  '直接把训练脚本当服务用': '训练和推理的优化方向完全不同。推理服务需要批处理、流式输出、并发控制、健康检查。',
  '不做版本管理': '部署了 v3 之后 v2 就找不到了。模型服务必须支持多版本并存、灰度切换、一键回滚。',
  // m16
  '实验散在各处找不到': '没有统一的实验登记和索引，半年后你只剩一堆叫 final-v2-really-final 的文件夹。',
  '只存成功的实验': '失败的实验比成功的更有价值——它告诉你什么路走不通。所有失败实验必须记录原因和现象。',
};

function initErrorDetails() {
  const errorSection = document.querySelector('.errors ul');
  if (!errorSection) return;
  const items = errorSection.querySelectorAll('li');
  items.forEach(li => {
    const text = li.textContent.trim();
    const explanation = ERROR_EXPLANATIONS[text];
    if (explanation) {
      li.innerHTML = `<details><summary>${text}</summary><p>${explanation}</p></details>`;
    }
  });
}

// ── 首页全局进度仪表盘 ────────────────────────────────────
function initHomeDashboard() {
  if (!location.pathname.endsWith('index.html') && location.pathname !== '/') return;
  const cards = document.querySelectorAll('.home-grid .card');
  if (!cards.length) return;

  // 给每张卡片加进度条
  cards.forEach((card, i) => {
    const mid = COURSE[i]?.id;
    if (!mid) return;
    const pct = getLocalModuleProgress(mid);
    const bar = document.createElement('div');
    bar.className = 'card-progress';
    bar.innerHTML = `<div class="card-progress-bar"><i style="width:${pct}%"></i></div>
                     <span>${pct}%</span>`;
    card.appendChild(bar);
  });

  // 顶部加总体进度大字
  let total = 0, done = 0;
  for (const [mid, count] of Object.entries(MODULE_TASK_COUNT)) {
    total += count;
    const prefix = Store.prefix + mid + '.html:';
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(prefix) && localStorage.getItem(k) === '1') done++;
    }
  }
  const pct = total ? Math.round(done / total * 100) : 0;

  // 插入到 hero 区域
  const hero = document.querySelector('.hero');
  if (hero) {
    const stat = document.createElement('div');
    stat.className = 'hero-stat';
    stat.innerHTML = `
      <div class="hero-stat-num">${pct}%</div>
      <div class="hero-stat-label">整体进度 · ${done}/${total} 个任务完成</div>
    `;
    hero.querySelector('.wrap').appendChild(stat);
  }
}

// ── 搜索功能 ──────────────────────────────────────────────
function initSearch() {
  // 顶部加搜索按钮，点击展开搜索框
  const topin = document.querySelector('.topin');
  if (!topin) return;

  const searchBtn = document.createElement('button');
  searchBtn.className = 'btn search-btn';
  searchBtn.textContent = '🔍 搜索';
  searchBtn.style.cursor = 'pointer';
  searchBtn.style.background = 'transparent';
  searchBtn.style.border = '1px solid var(--line)';
  searchBtn.style.color = '#fff';
  searchBtn.style.fontSize = '13px';
  topin.insertBefore(searchBtn, topin.lastElementChild);

  // 搜索遮罩
  const overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.innerHTML = `
    <div class="search-box">
      <input type="text" placeholder="搜索所有课程内容… (按 / 聚焦, Esc 关闭)" autofocus>
      <div class="search-results"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  let searchIndex = null;
  let searchLoaded = false;

  async function loadSearchIndex() {
    if (searchLoaded) return;
    searchLoaded = true;
    searchIndex = [];
    // 加载所有课程页面
    for (const m of COURSE) {
      try {
        const res = await fetch(m.id + '.html');
        const html = await res.text();
        // 提取正文文本
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const content = doc.querySelector('.content');
        if (!content) continue;
        const text = content.innerText.replace(/\s+/g, ' ').trim();
        searchIndex.push({ id: m.id, title: m.title, text, url: m.id + '.html' });
      } catch (e) { /* 忽略 */ }
    }
    // 加术语表
    try {
      const res = await fetch('glossary.html');
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const text = doc.body.innerText.replace(/\s+/g, ' ').trim();
      searchIndex.push({ id: 'glossary', title: '术语表', text, url: 'glossary.html' });
    } catch (e) {}
  }

  function search(query) {
    if (!searchIndex || !query.trim()) return [];
    const q = query.toLowerCase();
    const results = [];
    for (const item of searchIndex) {
      const titleMatch = item.title.toLowerCase().includes(q);
      const textMatch = item.text.toLowerCase().includes(q);
      if (titleMatch || textMatch) {
        // 找匹配位置附近的上下文
        let snippet = '';
        const idx = item.text.toLowerCase().indexOf(q);
        if (idx >= 0) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(item.text.length, idx + q.length + 40);
          snippet = (start > 0 ? '…' : '') + item.text.slice(start, end) + (end < item.text.length ? '…' : '');
          // 高亮匹配词
          snippet = snippet.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
            m => `<mark>${m}</mark>`);
        }
        results.push({ ...item, snippet, titleMatch });
      }
    }
    // 标题匹配排前面
    results.sort((a, b) => (b.titleMatch ? 1 : 0) - (a.titleMatch ? 1 : 0));
    return results.slice(0, 20);
  }

  function renderResults(results, query) {
    const container = overlay.querySelector('.search-results');
    if (!results.length) {
      container.innerHTML = `<div class="search-empty">没有找到「${query}」的结果</div>`;
      return;
    }
    container.innerHTML = results.map(r => `
      <a href="${r.url}" class="search-item">
        <div class="search-item-title">${r.title}</div>
        ${r.snippet ? `<div class="search-item-snippet">${r.snippet}</div>` : ''}
      </a>
    `).join('');
  }

  function openSearch() {
    overlay.classList.add('open');
    loadSearchIndex().then(() => {
      overlay.querySelector('input').focus();
    });
  }

  function closeSearch() {
    overlay.classList.remove('open');
  }

  searchBtn.addEventListener('click', openSearch);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeSearch();
  });

  const input = overlay.querySelector('input');
  let searchTimer;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = input.value;
    searchTimer = setTimeout(() => {
      const results = search(q);
      renderResults(results, q);
    }, 150);
  });

  // 点击结果跳转
  overlay.querySelector('.search-results').addEventListener('click', e => {
    const item = e.target.closest('.search-item');
    if (item) {
      closeSearch();
    }
  });

  // 键盘快捷键
  document.addEventListener('keydown', e => {
    // / 聚焦搜索
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = document.activeElement?.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !document.querySelector('.search-overlay.open')) {
        e.preventDefault();
        openSearch();
      }
    }
    // Esc 关闭
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      closeSearch();
    }
  });
}

// ── 键盘快捷键（课程导航）──────────────────────────────────
function initKeyboardNav() {
  // 只有课程页面生效
  const path = location.pathname.split('/').pop() || '';
  const isModule = /^m\d{2}\.html$/.test(path);
  if (!isModule) return;

  document.addEventListener('keydown', e => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === 'j' || e.key === 'ArrowRight') {
      // 下一课
      const next = document.querySelector('.pager a:last-child');
      if (next) location.href = next.href;
    }
    if (e.key === 'k' || e.key === 'ArrowLeft') {
      // 上一课
      const prev = document.querySelector('.pager a:first-child');
      if (prev) location.href = prev.href;
    }
    if (e.key === 't') {
      // 回顶部
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (e.key === 'h') {
      location.href = 'index.html';
    }
  });
}

// ── 移动端抽屉菜单 ────────────────────────────────────────
function initMobileMenu() {
  // 在模块页面的 top bar 加菜单按钮
  const topin = document.querySelector('.topin');
  const side = document.querySelector('aside.side');
  if (!topin || !side) return;

  const menuBtn = document.createElement('button');
  menuBtn.className = 'mobile-menu-btn';
  menuBtn.innerHTML = '☰';
  menuBtn.style.display = 'none';
  topin.insertBefore(menuBtn, topin.firstChild);

  // 检测移动端
  const mq = window.matchMedia('(max-width: 768px)');
  function update() {
    if (mq.matches) {
      menuBtn.style.display = 'block';
      side.classList.add('mobile-drawer');
    } else {
      menuBtn.style.display = 'none';
      side.classList.remove('mobile-drawer');
      side.classList.remove('open');
    }
  }
  mq.addEventListener('change', update);
  update();

  menuBtn.addEventListener('click', () => {
    side.classList.toggle('open');
  });

  // 点击遮罩关闭
  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.addEventListener('click', () => {
    side.classList.remove('open');
  });
  document.body.appendChild(overlay);

  // 点击链接后自动关
  side.addEventListener('click', e => {
    if (e.target.tagName === 'A' && mq.matches) {
      side.classList.remove('open');
      overlay.classList.remove('open');
    }
  });
}

// ── 进度导入导出 ──────────────────────────────────────────
function initImportExport() {
  const sideFoot = document.querySelector('.side-foot');
  if (!sideFoot) return;

  const actions = document.createElement('div');
  actions.className = 'side-actions';
  actions.innerHTML = `
    <button class="btn-text" id="export-progress">导出进度</button>
    <button class="btn-text" id="import-progress">导入进度</button>
    <input type="file" id="import-file" accept="application/json" style="display:none">
  `;
  sideFoot.appendChild(actions);

  document.getElementById('export-progress').addEventListener('click', () => {
    const data = Store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pail-progress-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('import-progress').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = Store.importAll(data);
      alert(`已导入 ${count} 条进度记录`);
      location.reload();
    } catch (err) {
      alert('导入失败：' + err.message);
    }
  });
}

// ── 云端同步层 ────────────────────────────────────────────
// 由 auth.js 注入，这里只预留接口
window.Sync = {
  pushOne(moduleId, taskId, checked) {
    // 如果登录了，推送到云端
    if (window.Auth && Auth.isLoggedIn() && Auth.isApiAvailable()) {
      Auth.saveProgress(moduleId, taskId, checked);
    }
  },
  pullAll() {
    if (window.Auth && Auth.isLoggedIn()) {
      return Auth.loadAllProgress();
    }
    return Promise.resolve(null);
  }
};

// ── 登录状态显示 ──────────────────────────────────────────
function initAuthUI() {
  const topin = document.querySelector('.topin');
  if (!topin) return;

  const authBtn = document.createElement('button');
  authBtn.className = 'btn auth-btn';
  authBtn.textContent = '登录';
  authBtn.style.cursor = 'pointer';
  authBtn.style.background = 'transparent';
  authBtn.style.border = '1px solid var(--line)';
  authBtn.style.color = '#fff';
  authBtn.style.fontSize = '13px';

  authBtn.addEventListener('click', () => {
    if (window.Auth) {
      Auth.showLoginModal();
    } else {
      alert('登录功能未加载');
    }
  });

  topin.insertBefore(authBtn, topin.lastElementChild);

  // 检查登录状态
  function updateAuthBtn() {
    if (window.Auth && Auth.isLoggedIn()) {
      const email = Auth.getUser()?.email || '';
      authBtn.textContent = email.length > 12 ? email.slice(0, 12) + '…' : email;
      authBtn.title = '点击登出';
      authBtn.onclick = () => {
        if (confirm('确定要登出吗？本地进度不会丢失。')) {
          Auth.logout();
          updateAuthBtn();
        }
      };
    } else if (window.Auth && !Auth.isApiAvailable()) {
      authBtn.textContent = '本地模式';
      authBtn.title = '云端同步需翻墙';
      authBtn.onclick = () => alert('云端同步功能需要翻墙才能使用。\n本地学习进度不受影响，保存在你的浏览器里。');
    } else {
      authBtn.textContent = '登录同步';
      authBtn.onclick = () => window.Auth && Auth.showLoginModal();
    }
  }

  // 等 auth.js 加载
  if (window.Auth) {
    updateAuthBtn();
  } else {
    document.addEventListener('auth-ready', updateAuthBtn);
  }
  // API 检测完成后再更新一次
  document.addEventListener('auth-api-checked', updateAuthBtn);
}

// ── 启动 ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectSidebar();
  initTasks();
  initCopyButtons();
  initGlossaryLinks();
  initGlossaryPage();
  initErrorDetails();
  initHomeDashboard();
  initSearch();
  initKeyboardNav();
  initMobileMenu();
  initImportExport();
  initAuthUI();

  // 如果已登录，拉取云端进度
  if (window.Auth && Auth.isLoggedIn()) {
    Sync.pullAll().then(remote => {
      if (remote && remote.length) {
        // 合并远端进度到本地（远端优先）
        let merged = 0;
        for (const item of remote) {
          const key = Store.prefix + item.module_id + '.html:' + item.task_id;
          const localVal = localStorage.getItem(key) === '1';
          if (item.completed && !localVal) {
            localStorage.setItem(key, '1');
            merged++;
          }
        }
        if (merged > 0) {
          location.reload();
        }
      }
    });
  }
});
