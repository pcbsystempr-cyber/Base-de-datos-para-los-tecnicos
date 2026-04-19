// ============================================
// COMPUTEC — Sistema de Soluciones Técnicas
// Escuela Superior Vocacional Pablo Colón Berdecia
// ============================================

// ======================== CONFIG ========================
let CREDENTIALS = { user: '', pass: '' };

const SUPABASE_URL = 'https://hexhpdijaecveravnyjz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ozEQdcE7f0aUXy5vGxiE-A_lqzceKqs';
const STORAGE_BUCKET = 'soluciones-imagenes';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentImages = [];
let aiLastResponse = '';
let chartInstances = {};
let pendingDeleteId = null;

async function loadCredentials() {
  const { data, error } = await supabaseClient
    .from('config')
    .select('username, password')
    .eq('id', 1)
    .single();
  
  if (data) {
    CREDENTIALS = { user: data.username || '', pass: data.password || '' };
  }
}

// ======================== AUTH ========================
async function doLogin() {
  try {
    if (!CREDENTIALS.user) {
      await loadCredentials();
    }
  } catch(e) {
    console.log('Using fallback credentials');
  }
  
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  const err = document.getElementById('login-error');

  // Fallback if no credentials in DB
  const validUser = CREDENTIALS.user || 'Tecnico';
  const validPass = CREDENTIALS.pass || 'Tecnico2026';

  if (u === validUser && p === validPass) {
    err.textContent = '';
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    localStorage.setItem('computec_logged_in', 'true');
    initApp();
  } else {
    err.textContent = '⚠️ Usuario o contraseña incorrectos.';
    document.getElementById('login-pass').value = '';
  }
}

function doLogout() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  localStorage.removeItem('computec_logged_in');
}

function togglePass() {
  const inp = document.getElementById('login-pass');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ======================== INIT ========================
async function initApp() {
  updateTopbarDate();
  clearInterval(window._computecClock);
  window._computecClock = setInterval(updateTopbarDate, 60000);

  const t = localStorage.getItem('computec_theme') || 'light';
  if (t === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }

  await renderDashboard();
}

function updateTopbarDate() {
  const now = new Date();
  const el = document.getElementById('topbar-date');
  if (!el) return;

  el.textContent =
    now.toLocaleDateString('es-PR', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }) +
    ' · ' +
    now.toLocaleTimeString('es-PR', {
      hour: '2-digit',
      minute: '2-digit'
    });
}

// ======================== NAVIGATION ========================
async function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById('section-' + name);
  const navBtn = document.querySelector(`[data-section="${name}"]`);

  if (section) section.classList.add('active');
  if (navBtn) navBtn.classList.add('active');

  document.getElementById('sidebar').classList.remove('open');

  if (name === 'dashboard') await renderDashboard();
  if (name === 'records') await renderRecords();
  if (name === 'stats') await renderStats();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ======================== THEME ========================
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  if (isDark) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('computec_theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('computec_theme', 'dark');
  }
}

// ======================== HELPERS DB ========================
function normalizarEstadoDesdeDB(estado) {
  const e = String(estado || '').toLowerCase().trim();
  if (e === 'resuelto') return 'resuelto';
  if (e === 'pendiente') return 'pendiente';
  if (e === 'en proceso' || e === 'en_proceso') return 'en_proceso';
  return 'resuelto';
}

function estadoParaDB(estadoFrontend) {
  const e = String(estadoFrontend || '').toLowerCase().trim();
  if (e === 'resuelto') return 'Resuelto';
  if (e === 'pendiente') return 'Pendiente';
  if (e === 'en_proceso') return 'En Proceso';
  return 'Resuelto';
}

function prioridadParaDB(prioridadFrontend) {
  const p = String(prioridadFrontend || '').toLowerCase().trim();
  if (p === 'alta') return 'Alta';
  if (p === 'urgente') return 'Urgente';
  if (p === 'baja') return 'Baja';
  return 'Normal';
}

function prioridadDesdeDB(prioridad) {
  const p = String(prioridad || '').toLowerCase().trim();
  if (p === 'alta') return 'alta';
  if (p === 'urgente') return 'urgente';
  if (p === 'baja') return 'baja';
  return 'normal';
}

async function getData() {
  const { data, error } = await supabaseClient
    .from('soluciones')
    .select('*')
    .order('fecha_registro', { ascending: false });

  if (error) {
    console.error('Error obteniendo datos:', error);
    showToast('Error cargando datos desde Supabase', 'error');
    return [];
  }

  return (data || []).map(item => ({
    id: String(item.id),
    techName: item.nombre_tecnico || '',
    grade: item.grado || '',
    group: item.grupo || '',
    category: item.categoria || '',
    priority: prioridadDesdeDB(item.prioridad),
    status: normalizarEstadoDesdeDB(item.estado),
    problem: item.problema || '',
    solution: item.solucion || '',
    notes: item.observaciones || '',
    date: item.fecha_registro ? item.fecha_registro.split('T')[0] : '',
    time: item.fecha_registro
      ? new Date(item.fecha_registro).toLocaleTimeString('es-PR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '',
    images: item.imagen_url ? [item.imagen_url] : []
  }));
}

async function getRecordById(id) {
  const { data, error } = await supabaseClient
    .from('soluciones')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error buscando registro:', error);
    showToast('No se pudo cargar el registro', 'error');
    return null;
  }

  return {
    id: String(data.id),
    techName: data.nombre_tecnico || '',
    grade: data.grado || '',
    group: data.grupo || '',
    category: data.categoria || '',
    priority: prioridadDesdeDB(data.prioridad),
    status: normalizarEstadoDesdeDB(data.estado),
    problem: data.problema || '',
    solution: data.solucion || '',
    notes: data.observaciones || '',
    date: data.fecha_registro ? data.fecha_registro.split('T')[0] : '',
    time: data.fecha_registro
      ? new Date(data.fecha_registro).toLocaleTimeString('es-PR', {
          hour: '2-digit',
          minute: '2-digit'
        })
      : '',
    images: data.imagen_url ? [data.imagen_url] : []
  };
}

async function upsertTecnico(nombreCompleto, grado, grupo) {
  if (!nombreCompleto) return;

  const { data: existente, error: errorBusqueda } = await supabaseClient
    .from('tecnicos')
    .select('id')
    .eq('nombre_completo', nombreCompleto)
    .maybeSingle();

  if (errorBusqueda) {
    console.error('Error buscando técnico:', errorBusqueda);
    return;
  }

  if (existente) {
    await supabaseClient
      .from('tecnicos')
      .update({ grado, grupo })
      .eq('id', existente.id);
    return;
  }

  const { error: errorInsert } = await supabaseClient
    .from('tecnicos')
    .insert([
      {
        nombre_completo: nombreCompleto,
        grado,
        grupo
      }
    ]);

  if (errorInsert) {
    console.error('Error insertando técnico:', errorInsert);
  }
}

async function subirImagen(file) {
  const extension = file.name.split('.').pop() || 'jpg';
  const nombreArchivo = `solucion_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;

  const { error: uploadError } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(nombreArchivo, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Error subiendo imagen:', uploadError);
    throw uploadError;
  }

  const { data } = supabaseClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(nombreArchivo);

  return data.publicUrl;
}

// ======================== DASHBOARD ========================
async function renderDashboard() {
  const records = await getData();
  const uniqueTechs = [...new Set(records.map(r => r.techName).filter(Boolean))];
  const withImages = records.filter(r => r.images && r.images.length > 0);
  const lastRecord = records.length ? records[0] : null;

  const statsData = [
    {
      label: 'Total Soluciones',
      value: records.length,
      icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z"/></svg>`,
      color: '#3b82f6',
      bg: '#dbeafe'
    },
    {
      label: 'Técnicos Registrados',
      value: uniqueTechs.length,
      icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>`,
      color: '#8b5cf6',
      bg: '#ede9fe'
    },
    {
      label: 'Problemas Registrados',
      value: records.length,
      icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"/></svg>`,
      color: '#f59e0b',
      bg: '#fef3c7'
    },
    {
      label: 'Con Imágenes',
      value: withImages.length,
      icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/></svg>`,
      color: '#10b981',
      bg: '#d1fae5'
    },
    {
      label: 'Resueltos',
      value: records.filter(r => r.status === 'resuelto').length,
      icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"/></svg>`,
      color: '#10b981',
      bg: '#d1fae5'
    },
    {
      label: 'Último Registro',
      value: lastRecord && lastRecord.date ? lastRecord.date + (lastRecord.time ? ' ' + lastRecord.time : '') : 'N/A',
      icon: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/></svg>`,
      color: '#f97316',
      bg: '#fff7ed'
    }
  ];

  document.getElementById('dash-stats').innerHTML = statsData.map(s => `
    <div class="stat-card">
      <div class="stat-icon" style="background:${s.bg};color:${s.color}">${s.icon}</div>
      <div>
        <div class="stat-num">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>
    </div>
  `).join('');

  const recent = records.slice(0, 6);
  document.getElementById('recent-list').innerHTML = recent.length
    ? recent.map(r => `
      <div class="recent-item">
        <div class="recent-dot" style="background:${statusColor(r.status)}"></div>
        <div>
          <div class="recent-title">${escHtml(r.problem.substring(0, 60))}${r.problem.length > 60 ? '…' : ''}</div>
          <div class="recent-meta">${escHtml(r.techName)} · ${r.grade} ${r.group} · ${formatDate(r.date)}</div>
        </div>
      </div>
    `).join('')
    : '<div class="empty-state" style="padding:30px"><p>No hay registros aún</p></div>';

  const techCounts = {};
  records.forEach(r => {
    if (!r.techName) return;
    techCounts[r.techName] = (techCounts[r.techName] || 0) + 1;
  });

  const topTechs = Object.entries(techCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  document.getElementById('tech-list').innerHTML = topTechs.length
    ? topTechs.map(([name, count]) => `
      <div class="tech-chip">
        <span class="tech-name">${escHtml(name)}</span>
        <span class="tech-count">${count}</span>
      </div>
    `).join('')
    : '<div style="color:var(--text-3);font-size:13px;padding:20px 0">No hay técnicos registrados</div>';
}

// ======================== RECORDS ========================
async function renderRecords(filterFn = null) {
  let records = await getData();
  if (filterFn) records = records.filter(filterFn);

  document.getElementById('records-count').textContent = `${records.length} registro(s) encontrado(s)`;

  if (!records.length) {
    document.getElementById('records-grid').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        <h3>No se encontraron registros</h3>
        <p>Ajusta los filtros o registra una nueva solución</p>
      </div>`;
    return;
  }

  document.getElementById('records-grid').innerHTML = [...records].reverse().map(r => `
    <div class="record-card" onclick="viewRecord('${r.id}')">
      <div class="record-card-header">
        <div>
          <div class="record-tech">${escHtml(r.techName)}</div>
          <div class="record-meta">${r.grade} · Grupo ${r.group} · ${formatDate(r.date)}</div>
        </div>
        <div class="record-badges">
          ${statusBadge(r.status)}
          ${priorityBadge(r.priority)}
          ${r.category ? `<span class="badge badge-purple">${escHtml(r.category)}</span>` : ''}
        </div>
      </div>
      <div class="record-card-body">
        <div class="record-problem">🔴 Problema:</div>
        <div class="record-problem-text">${escHtml(r.problem)}</div>
        <div class="record-solution-label">✅ Solución:</div>
        <div class="record-solution-text">${escHtml(r.solution)}</div>
        ${r.images && r.images.length ? `<div style="margin-top:10px;font-size:11px;color:var(--text-3)">📷 ${r.images.length} imagen(es) adjunta(s)</div>` : ''}
      </div>
      <div class="record-card-footer" onclick="event.stopPropagation()">
        <button class="btn-sm btn-sm-green" onclick="viewRecord('${r.id}')">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10z"/></svg>
          Ver
        </button>
        <button class="btn-sm" onclick="editRecord('${r.id}')">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
          Editar
        </button>
        <button class="btn-sm" onclick="copyRecord('${r.id}')">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
          Copiar
        </button>
        <button class="btn-sm btn-sm-danger" onclick="confirmDelete('${r.id}')">
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"/></svg>
          Eliminar
        </button>
      </div>
    </div>
  `).join('');
}

function filterRecords() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const grade = document.getElementById('filter-grade').value;
  const group = document.getElementById('filter-group').value;
  const status = document.getElementById('filter-status').value;
  const date = document.getElementById('filter-date').value;

  renderRecords(r => {
    const matchQ =
      !query ||
      r.problem.toLowerCase().includes(query) ||
      r.solution.toLowerCase().includes(query) ||
      r.techName.toLowerCase().includes(query);

    const matchG = !grade || r.grade === grade;
    const matchGr = !group || r.group === group;
    const matchS = !status || r.status === status;
    const matchD = !date || r.date.startsWith(date);

    return matchQ && matchG && matchGr && matchS && matchD;
  });
}

// ======================== VIEW RECORD ========================
async function viewRecord(id) {
  const r = await getRecordById(id);
  if (!r) return;

  const modal = document.getElementById('modal-content');
  modal.innerHTML = `
    <div class="modal-header">
      <div>
        <h2>${escHtml(r.techName)}</h2>
        <div style="font-size:13px;color:var(--text-3);margin-top:4px">${r.grade} · Grupo ${r.group} · ${formatDate(r.date)} ${r.time ? '· ' + r.time : ''}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">
        ${statusBadge(r.status)} ${priorityBadge(r.priority)}
        ${r.category ? `<span class="badge badge-purple">${escHtml(r.category)}</span>` : ''}
      </div>

      <div class="modal-field">
        <div class="modal-field-label">🔴 Problema Presentado</div>
        <div class="modal-field-value">${escHtml(r.problem)}</div>
      </div>

      <div class="modal-field">
        <div class="modal-field-label" style="color:var(--green)">✅ Solución Aplicada</div>
        <div class="modal-field-value">${escHtml(r.solution)}</div>
        <button class="copy-btn" style="margin-top:8px" onclick="navigator.clipboard.writeText(${JSON.stringify(r.solution)});showToast('Solución copiada','success')">📋 Copiar solución</button>
      </div>

      ${r.notes ? `
        <div class="modal-field">
          <div class="modal-field-label">📝 Observaciones</div>
          <div class="modal-field-value">${escHtml(r.notes)}</div>
        </div>
      ` : ''}

      ${r.images && r.images.length ? `
        <div class="modal-field">
          <div class="modal-field-label">📷 Imágenes</div>
          <div class="modal-images">
            ${r.images.map(img => `<img src="${img}" onclick="openImageFull('${img}')">`).join('')}
          </div>
        </div>
      ` : ''}

      <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
        <button class="btn-primary" onclick="closeModal();editRecord('${r.id}')">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793z"/></svg>
          Editar
        </button>
        <button class="btn-secondary" onclick="printRecord('${r.id}')">🖨️ Imprimir</button>
        <button class="btn-danger" onclick="closeModal();confirmDelete('${r.id}')">Eliminar</button>
      </div>
    </div>
  `;

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openImageFull(src) {
  const win = window.open('', '_blank');
  win.document.write(`<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${src}" style="max-width:100%;max-height:100vh"></body></html>`);
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ======================== SAVE / EDIT ========================
async function saveRecord(e) {
  e.preventDefault();

  const id = document.getElementById('main-form').dataset.editId || null;
  const techName = document.getElementById('f-name').value.trim();
  const grade = document.getElementById('f-grade').value;
  const group = document.getElementById('f-group').value;
  const category = document.getElementById('f-category').value;
  const priority = document.getElementById('f-priority').value;
  const status = document.getElementById('f-status').value;
  const problem = document.getElementById('f-problem').value.trim();
  const solution = document.getElementById('f-solution').value.trim();
  const notes = document.getElementById('f-notes').value.trim();

  if (!techName || !grade || !group || !category || !problem || !solution) {
    showToast('Completa todos los campos obligatorios', 'warning');
    return;
  }

  try {
    let imagenUrl = null;

    if (currentImages.length > 0) {
      imagenUrl = currentImages[0];
    }

    await upsertTecnico(techName, grade, group);

    const payload = {
      nombre_tecnico: techName,
      grado: grade,
      grupo: group,
      categoria: category,
      prioridad: prioridadParaDB(priority),
      estado: estadoParaDB(status),
      problema: problem,
      solucion: solution,
      observaciones: notes || null,
      imagen_url: imagenUrl
    };

    if (id) {
      const { error } = await supabaseClient
        .from('soluciones')
        .update(payload)
        .eq('id', id);

      if (error) throw error;
    } else {
      const { error } = await supabaseClient
        .from('soluciones')
        .insert([payload]);

      if (error) throw error;
    }

    clearForm();
    showToast(id ? 'Registro actualizado exitosamente ✅' : '¡Registro guardado exitosamente! 🎉', 'success');
    await showSection('records');
  } catch (error) {
    console.error('Error guardando registro:', error);
    showToast('No se pudo guardar el registro', 'error');
  }
}

async function editRecord(id) {
  const r = await getRecordById(id);
  if (!r) return;

  await showSection('register');

  document.getElementById('f-name').value = r.techName;
  document.getElementById('f-grade').value = r.grade;
  document.getElementById('f-group').value = r.group;
  document.getElementById('f-category').value = r.category || '';
  document.getElementById('f-priority').value = r.priority || 'normal';
  document.getElementById('f-status').value = r.status || 'resuelto';
  document.getElementById('f-problem').value = r.problem;
  document.getElementById('f-solution').value = r.solution;
  document.getElementById('f-notes').value = r.notes || '';

  currentImages = r.images || [];
  renderImagePreviews();

  document.getElementById('main-form').dataset.editId = id;
  document.querySelector('#section-register .section-header h1').textContent = 'Editar Registro';
  window.scrollTo(0, 0);
}

function clearForm() {
  document.getElementById('main-form').reset();
  delete document.getElementById('main-form').dataset.editId;
  currentImages = [];
  document.getElementById('image-preview').innerHTML = '';
  const title = document.querySelector('#section-register .section-header h1');
  if (title) title.textContent = 'Registrar Nueva Solución';
}

// ======================== DELETE ========================
function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('confirm-overlay').classList.remove('hidden');
  document.getElementById('confirm-btn').onclick = async () => {
    try {
      const { error } = await supabaseClient
        .from('soluciones')
        .delete()
        .eq('id', pendingDeleteId);

      if (error) throw error;

      closeConfirm();
      showToast('Registro eliminado', 'error');
      await renderRecords();
      await renderDashboard();
    } catch (err) {
      console.error('Error eliminando registro:', err);
      showToast('No se pudo eliminar el registro', 'error');
    }
  };
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.add('hidden');
  pendingDeleteId = null;
}

// ======================== IMAGES ========================
async function previewImages(e) {
  const files = Array.from(e.target.files || []);

  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      showToast('Imagen muy grande (max 5MB)', 'error');
      continue;
    }

    try {
      const publicUrl = await subirImagen(file);
      currentImages.push(publicUrl);
      renderImagePreviews();
    } catch (error) {
      console.error(error);
      showToast('No se pudo subir una imagen', 'error');
    }
  }

  e.target.value = '';
}

function renderImagePreviews() {
  document.getElementById('image-preview').innerHTML = currentImages.map((img, i) => `
    <div class="preview-item">
      <img src="${img}" alt="Preview ${i + 1}">
      <button class="preview-remove" onclick="removeImage(${i})">×</button>
    </div>
  `).join('');
}

function removeImage(idx) {
  currentImages.splice(idx, 1);
  renderImagePreviews();
}

// ======================== COPY / PRINT ========================
async function copyRecord(id) {
  const r = await getRecordById(id);
  if (!r) return;

  const text = `PROBLEMA: ${r.problem}\n\nSOLUCIÓN: ${r.solution}${r.notes ? '\n\nOBSERVACIONES: ' + r.notes : ''}`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Registro copiado al portapapeles 📋', 'success');
  });
}

async function printRecord(id) {
  const r = await getRecordById(id);
  if (!r) return;

  const w = window.open('', '_blank');
  w.document.write(`
    <html>
      <head>
        <title>Registro COMPUTEC</title>
        <style>
          body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;padding:20px}
          h1{color:#1e40af;border-bottom:2px solid #1e40af;padding-bottom:10px}
          .section{margin:20px 0;background:#f8f9fa;padding:16px;border-radius:8px;border-left:4px solid #3b82f6}
          .section h3{color:#1e40af;margin-bottom:8px}
          .meta{display:flex;gap:20px;color:#555;font-size:13px;margin-bottom:20px;flex-wrap:wrap}
        </style>
      </head>
      <body>
        <h1>COMPUTEC — Registro Técnico</h1>
        <div class="meta">
          <span><b>Técnico:</b> ${escHtml(r.techName)}</span>
          <span><b>Grado:</b> ${r.grade}</span>
          <span><b>Grupo:</b> ${r.group}</span>
          <span><b>Fecha:</b> ${formatDate(r.date)}</span>
        </div>
        <div class="section">
          <h3>🔴 Problema Presentado</h3>
          <p>${escHtml(r.problem)}</p>
        </div>
        <div class="section" style="border-left-color:#10b981">
          <h3>✅ Solución Aplicada</h3>
          <p>${escHtml(r.solution)}</p>
        </div>
        ${r.notes ? `<div class="section" style="border-left-color:#f59e0b"><h3>📝 Observaciones</h3><p>${escHtml(r.notes)}</p></div>` : ''}
        <p style="color:#888;font-size:12px;margin-top:30px">Escuela Superior Vocacional Pablo Colón Berdecia · Departamento de Tecnología COMPUTEC</p>
        <script>window.print()</script>
      </body>
    </html>
  `);
}

// ======================== EXPORT CSV ========================
async function exportToCSV() {
  const records = await getData();

  if (!records.length) {
    showToast('No hay registros para exportar', 'warning');
    return;
  }

  const headers = ['ID', 'Técnico', 'Grado', 'Grupo', 'Categoría', 'Prioridad', 'Estado', 'Problema', 'Solución', 'Observaciones', 'Fecha', 'Hora'];

  const rows = records.map(r => [
    r.id,
    r.techName,
    r.grade,
    r.group,
    r.category || '',
    r.priority || '',
    r.status || '',
    (r.problem || '').replace(/"/g, '""'),
    (r.solution || '').replace(/"/g, '""'),
    (r.notes || '').replace(/"/g, '""'),
    r.date || '',
    r.time || ''
  ].map(v => `"${v}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = `COMPUTEC_Registros_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();

  URL.revokeObjectURL(url);
  showToast('Datos exportados a CSV ✅', 'success');
}

// ======================== STATS ========================
async function renderStats() {
  const records = await getData();

  document.getElementById('stats-content').innerHTML = `
    <div class="stats-content-grid">
      <div class="chart-card">
        <h3>📊 Soluciones por Categoría</h3>
        <div class="chart-wrap"><canvas id="chart-cat"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>👥 Registros por Técnico</h3>
        <div class="chart-wrap"><canvas id="chart-tech"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>🎓 Incidencias por Grado</h3>
        <div class="chart-wrap"><canvas id="chart-grade"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>📈 Estado de Registros</h3>
        <div class="chart-wrap"><canvas id="chart-status"></canvas></div>
      </div>
      <div class="chart-card full-width">
        <h3>📅 Registros por Fecha (últimos 14 días)</h3>
        <div class="chart-wrap" style="height:180px"><canvas id="chart-dates"></canvas></div>
      </div>
    </div>
  `;

  Object.values(chartInstances).forEach(c => c.destroy());
  chartInstances = {};

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'];

  const catCounts = {};
  records.forEach(r => {
    const key = r.category || 'Sin categoría';
    catCounts[key] = (catCounts[key] || 0) + 1;
  });
  makeBarChart('chart-cat', Object.keys(catCounts), Object.values(catCounts), COLORS);

  const techCounts = {};
  records.forEach(r => {
    techCounts[r.techName] = (techCounts[r.techName] || 0) + 1;
  });
  const topTechs = Object.entries(techCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  makeBarChart('chart-tech', topTechs.map(t => t[0]), topTechs.map(t => t[1]), COLORS);

  const gradeCounts = {};
  records.forEach(r => {
    gradeCounts[r.grade] = (gradeCounts[r.grade] || 0) + 1;
  });
  makeDoughnutChart('chart-grade', Object.keys(gradeCounts), Object.values(gradeCounts), COLORS);

  const statusCounts = { resuelto: 0, en_proceso: 0, pendiente: 0 };
  records.forEach(r => {
    statusCounts[r.status || 'resuelto']++;
  });
  makeDoughnutChart(
    'chart-status',
    ['Resuelto', 'En Proceso', 'Pendiente'],
    Object.values(statusCounts),
    ['#10b981', '#f59e0b', '#ef4444']
  );

  const today = new Date();
  const dateCounts = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dateCounts[d.toISOString().split('T')[0]] = 0;
  }

  records.forEach(r => {
    if (dateCounts[r.date] !== undefined) {
      dateCounts[r.date]++;
    }
  });

  makeLineChart('chart-dates', Object.keys(dateCounts).map(d => d.slice(5)), Object.values(dateCounts));
}

function makeBarChart(id, labels, data, colors) {
  const ctx = document.getElementById(id).getContext('2d');
  chartInstances[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function makeDoughnutChart(id, labels, data, colors) {
  const ctx = document.getElementById(id).getContext('2d');
  chartInstances[id] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { size: 11 } }
        }
      }
    }
  });
}

function makeLineChart(id, labels, data) {
  const ctx = document.getElementById(id).getContext('2d');
  chartInstances[id] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        fill: true,
        backgroundColor: 'rgba(59,130,246,.12)',
        borderColor: '#3b82f6',
        tension: 0.4,
        pointBackgroundColor: '#3b82f6',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

// ======================== AI ========================
function setAIPrompt(text) {
  document.getElementById('ai-input').value = text;
  document.getElementById('ai-input').focus();
}

function useAIInForm() {
  const problem = document.getElementById('ai-input').value.trim();

  if (!problem) {
    showToast('Escribe un problema primero', 'warning');
    return;
  }

  showSection('register');
  document.getElementById('f-problem').value = problem;

  if (aiLastResponse) {
    document.getElementById('f-solution').value = aiLastResponse.substring(0, 800);
  }

  showToast('Problema cargado en el formulario ✅', 'success');
}

async function sendToAI() {
  const input = document.getElementById('ai-input');
  const problem = input.value.trim();

  if (!problem) {
    showToast('Por favor escribe un problema técnico', 'warning');
    return;
  }

  const chatArea = document.getElementById('ai-chat');
  const sendBtn = document.getElementById('ai-send-btn');

  const welcome = chatArea.querySelector('.ai-welcome');
  if (welcome) welcome.remove();

  chatArea.innerHTML += `
    <div class="ai-message user">
      <div>
        <div class="ai-bubble">${escHtml(problem)}</div>
        <div class="ai-meta" style="text-align:right">Tú · ${new Date().toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>
  `;

  input.value = '';
  sendBtn.disabled = true;

  const loadId = 'loading-' + Date.now();
  chatArea.innerHTML += `
    <div class="ai-message ai" id="${loadId}">
      <div class="ai-bubble ai-loading">
        <div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>
      </div>
    </div>
  `;

  chatArea.scrollTop = chatArea.scrollHeight;

  try {
    const API_KEY = 'AIzaSyAO53_Du3Ic95Yq_1ujihkvUBH3_F4jhM4';
    const systemPrompt = `Eres "Asistente COMPUTEC", un asistente técnico especializado de la Escuela Superior Vocacional Pablo Colón Berdecia, Departamento de Tecnología.

CONOCIMIENTO TÉCNICO EXHAUSTIVO:

1. FUNDAMENTOS DIGITALES:
- Tecnología: aplicación del conocimiento científico para resolver problemas prácticos
- Dato: representación simbólica de información (números, texto, imágenes)
- Información: datos procesados con significado y contexto
- Conocimiento: información aplicada para tomar decisiones
- Hardware: componentes físicos del computador (CPU, RAM, disco, placa base, periféricos)
- Software: programas e instrucciones lógicas (sistemas operativos, aplicaciones)
- Firmware: software almacenado en memoria no volátil (BIOS/UEFI)
- Sistema informáticos: conjunto de hardware, software, datos y usuarios
- Computadora: dispositivo electrónico que procesa información mediante programas
- Dispositivo móvil: smartphone o tablet con capacidades computacionales limitadas
- Internet: red global de computadores interconectados
- Red: conjunto de dispositivos conectados para compartir recursos
- Archivo: unidad de información almacenada (documentos, imágenes, ejecutables)
- Carpeta: directorio que organiza archivos jerárquicamente
- Extensión: sufijo que indica el tipo de archivo (.pdf, .jpg, .docx)
- Memoria: almacenamiento temporal de datos (RAM volátil)
- Almacenamiento:保存 permanente de datos (HDD, SSD, NVMe)
- Procesamiento: ejecución de operaciones por la CPU

2. HARDWARE DE COMPUTADORAS:
- Placa base (motherboard): circuito principal que conecta todos los componentes
- CPU/Procesador: unidad central de procesamiento, "cerebro" del computador
- RAM: memoria de acceso aleatorio, almacenamiento temporal rápido
- Disco duro HDD: almacenamiento magnético mecánico
- SSD SATA: unidad de estado sólido conectad por SATA (más rápido que HDD)
- SSD NVMe: unidad NVMe sobre PCIe, velocidad ultra-rápida (hasta 7000 MB/s)
- Fuente de poder (PSU): convierte corriente AC a DC para componentes
- Tarjeta gráfica (GPU): procesamiento de gráficos y cálculos paralelos
- Sistema de enfriamiento: disipadores, ventiladores, refrigeración líquida
- BIOS/UEFI: firmware de inicio que configura hardware antes del SO
- Puertos: USB (datos y carga), HDMI (video/audio), DisplayPort (video), VGA (video analógico), Ethernet (red), audio (jack 3.5mm)
- Periféricos: teclado, mouse, monitor, webcam, bocinas, micrófono, impresoras

3. SOFTWARE:
- Sistema operativo: software base (Windows, Linux, macOS, Android, iOS)
- Programas de aplicación: software de usuario (Office, navegador, editor)
- Controladores/drivers: software que permite al SO comunicarse con hardware
- Utilidades del sistema: herramientas de mantenimiento y configuración
- Navegadores: Chrome, Firefox, Edge, Safari
- Suites de oficina: Microsoft Office, Google Docs, LibreOffice
- Software educativo: plataformas de aprendizaje
- Software de diseño: Photoshop, Illustrator, GIMP, Inkscape
- Software de seguridad: antivirus, antimalware, firewall

4. SISTEMAS OPERATIVOS:
- Windows: SO más usado, versiones 10 y 11
- Linux: SO open source (Ubuntu, Debian, Fedora, Arch)
- macOS: SO de Apple
- Android: SO móvil de Google
- iOS/iPadOS: SO móvil de Apple
- Gestión de usuarios: cuentas locales, dominio, permisos
- Permisos: lectura, escritura, ejecución (rwx)
- Arranque del sistema: BIOS → bootloader → kernel → servicios
- Recuperación: modo seguro, restauración del sistema, reinstalación

5. REDES:
- Red LAN: Local Area Network, red local (casa, oficina)
- Red WAN: Wide Area Network, red de área amplia (Internet)
- WLAN: red LAN inalámbrica (WiFi)
- Router: dispositivo que conecta redes y enruta tráfico
- Switch: conecta dispositivos en LAN, envía datos al puerto correcto
- Access Point (AP): punto de acceso WiFi
- Dirección IP: identificador único de dispositivo en red (IPv4: x.x.x.x, IPv6)
- IP pública: dirección visible en Internet (asignada por ISP)
- IP privada: dirección interna (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Máscara de subred: define qué porción de IP es red/host (255.255.255.0 = /24)
- Gateway: puerta de enlace, router que conecta LAN a Internet
- DNS: Domain Name System, traduce dominios a IP (ej: google.com → 142.250.x.x)
- DHCP: Dynamic Host Configuration Protocol, asigna IPs automáticamente
- MAC address: Media Access Control, identificador único de hardware (AA:BB:CC:DD:EE:FF)
- Ping: herramienta para probar conectividad (ping 8.8.8.8)
- Velocidad de red: Mbps (megabits por segundo)
- Cableado Ethernet: Cat5e (1Gbps), Cat6 (10Gbps), Cat6a, Cat7, Cat8
- WiFi 2.4 GHz: mayor alcance, más interferencia, hasta 600 Mbps
- WiFi 5 GHz: menos interferencia, mayor velocidad, menor alcance
- Problemas comunes: sin conexión, IP conflictiva, DNS fallando, firewall bloqueando

6. INTERNET Y WEB:
- Sitio web: colección de páginas web relacionadas
- Página web: documento HTML mostrado en navegador
- Dominio: nombre legible de sitio (ej: computec.edu)
- Hosting: servicio de almacenamiento de sitios web
- Servidor: computadora que提供服务 (web, archivo, base de datos)
- HTTP: HyperText Transfer Protocol (sin cifrar)
- HTTPS: HTTP Secure (cifrado con TLS/SSL)
- URL: Uniform Resource Locator, dirección de recurso web
- Cookies: pequeños datos almacenados por sitios web
- Caché: almacenamiento temporal de datos para acceso rápido
- Formularios web: campos para ingresar datos (HTML <form>)
- Frontend: parte visual (HTML, CSS, JavaScript)
- Backend: parte servidor (PHP, Python, Node.js, bases de datos)
- HTML: lenguaje de marcado de hipertexto
- CSS: lenguaje de estilos visuales
- JavaScript: lenguaje de programación web dinámico
- APIs: Application Programming Interfaces,interfaces para comunicar sistemas

7. SOPORTE TÉCNICO:
- Diagnóstico paso a paso: metodología sistemática de resolución de problemas
- Identificación del problema: definir qué ocurre y cuándo
- Reproducción del error: intentar repetir el problema
- Registro de incidencias: documentar síntomas, acciones, soluciones
- Solución temporal: parcheo inmediato (workaround)
- Solución definitiva: correcciónroot cause
- Mantenimiento preventivo: acciones para evitar problemas (limpieza, actualizaciones)
- Mantenimiento correctivo: reparación después de fallo
- Formateo: instalación limpia del sistema operativo
- Respaldo/backup: copia de seguridad de datos
- Restauración: recuperar datos desde backup
- Atención al usuario: comunicación clara, empática, técnica
- Documentación técnica: manuales, guías, wikis

8. SEGURIDAD INFORMÁTICA:
- Contraseñas seguras: mínimo 12 caracteres, mezcla mayúsculas, números, símbolos
- Autenticación de dos factores (2FA): verificación en dos pasos (SMS, app, hardware)
- Malware: software malicioso (virus, gusanos, troyanos, spyware, ransomware)
- Virus: malware que se replica adjuntando a otros archivos
- Ransomware: malware que cifra archivos y exige rescate
- Phishing: estafa mediante correos/mensajes falsos para robar credenciales
- Ingeniería social: manipulación psicológica para obtener información
- Antivirus: software que detecta y elimina malware
- Firewall: barrera que filtra tráfico de red (Windows Defender, Linux iptables)
- Cifrado: transformación de datos para que solo autorizado los lea (AES, RSA)
- Copias de seguridad: respaldo en disco externo, nube, otra ubicación
- Actualizaciones de seguridad: parches para vulnerabilidad
- Buenas prácticas: no abrir adjuntos sospechosos, verificar URLs, usar VPN en públicas
- Privacidad digital: proteger información personal

9. PROGRAMACIÓN:
- Programar: escribir instrucciones para que computador ejecute tareas
- Algoritmo: secuencia de pasos para resolver un problema
- Variable: contenedor de datos (let nombre = "Juan")
- Condicional: decisión (if/else, switch)
- Bucle: repetición (for, while, do-while)
- Función: bloque reutilizable de código
- Arreglo/lista: colección ordenada de elementos
- Objeto: estructura con propiedades y métodos
- Clase: plantilla para crear objetos
- Error sintáctico: violation de reglas del lenguaje
- Error lógico: el programa corre pero da resultado incorrecto
- Depuración: encontrar y corregir errores (debugger, console.log)
- JavaScript: lenguaje web del lado del cliente
- Python: lenguaje versátil, fácil aprendizaje
- Java: lenguaje orientado a objetos, portable
- C#: lenguaje de Microsoft, usado en .NET
- PHP: lenguaje del lado del servidor
- Git: sistema de control de versiones

10. BASES DE DATOS:
- Base de datos: almacenamiento estructurado de información
- Tabla: estructura con filas (registros) y columnas (campos)
- Registro: fila con datos de una entidad
- Campo: columna que define tipo de dato
- Clave primaria: identificador único de registro
- Clave foránea: campo que relaciona tablas
- Relación: conexión entre tablas (1:1, 1:N, N:M)
- SQL: Structured Query Language
- SELECT: consultar datos
- INSERT: agregar datos
- UPDATE: modificar datos
- DELETE: eliminar datos
- Supabase: base de datos PostgreSQL en la nube
- Firebase: plataforma de Google para apps
- Almacenamiento en nube: datos remotos accesibles vía Internet

11. CLOUD Y SERVICIOS EN LÍNEA:
- Computación en la nube: servicios informáticos por Internet
- SaaS: Software as a Service (Google Docs, Office 365)
- PaaS: Platform as a Service (Heroku, Vercel)
- IaaS: Infrastructure as a Service (AWS, Azure)
- Google Drive, OneDrive, Dropbox: almacenamiento en la nube
- Sincronización: actualizar archivos en todos dispositivos
- APIs de nube: interfaces para integrar servicios cloud

12. INTELIGENCIA ARTIFICIAL:
- IA: capacidad de máquinas para simular inteligencia humana
- Machine Learning: IA que aprende de datos sin programación explícita
- Deep Learning: redes neuronales profundas para tareas complejas
- Modelos generativos: IA que crea contenido (texto, imágenes)
- Chatbots: programas que conversan con usuarios
- Prompts: instrucciones dadas a IA generativa
- Limitaciones: puede generar información incorrecta (hallucinations)
- Hallucinations: respuestas inventadas por IA que parecen reales
- Uso responsable: verificar información, no confiar ciegamente
- Automatización con IA: tareas repetitivas realizadas por IA

13. DISPOSITIVOS MÓVILES:
- Android: SO de Google, código abierto
- iPhone/iPad: dispositivos Apple con iOS/iPadOS
- Almacenamiento: memoria interna y tarjetas SD
- Aplicaciones: apps descargadas de Play Store/App Store
- Seguridad: bloqueo, encriptación, localizar mi dispositivo
- Cuentas: Google Account, Apple ID
- Restauración: reset a fábrica, recuperación desde backup
- Problemas comunes: batería, conectividad, almacenamiento lleno

14. IMPRESORAS Y PERIFÉRICOS:
- Tipos: inyección, láser, matriz de puntos, sublimación
- Drivers: software de comunicación con impresora
- Cola de impresión: cola de trabajos pendientes
- Problemas de conexión: USB, red, WiFi
- Tinta y tóner: consumibles de impresión
- Papel atascado: problema común, revisar rodillos
- Impresión en red: impresoras compartidas en LAN
- Escáner: digitalización de documentos
- Multifuncionales: impresoras con escáner, copiadora, fax

15. ELECTRÓNICA BÁSICA:
- Voltaje (V): diferencia de potencial eléctrico
- Corriente (A): flujo de electrones
- Resistencia (Ω): oposición al flujo de corriente
- Potencia (W): tasa de transferencia de energía (V × A)
- DC: Corriente Directa (baterías, adaptadores)
- AC: Corriente Alterna (tomacorientes)
- Fuente de alimentación: convierte AC a DC
- Continuidad: conexión eléctrica entre puntos
- Cortocircuito: conexión no intencional de polos
- Multímetro: herramienta para medir V, A, Ω

16. VIRTUALIZACIÓN:
- Máquina virtual: SO simulado dentro de otro SO
- Hyper-V: virtualización de Microsoft
- VirtualBox: virtualización de Oracle (gratuita)
- VMware: virtualización profesional
- Snapshots: instantánea del estado de VM
- Pruebas seguras: ambiente aislado para testing

17. ADMINISTRACIÓN DE SISTEMAS:
- Usuarios y grupos: gestión de accesos
- Políticas: reglas de seguridad y comportamiento
- Servicios: procesos en segundo plano
- Logs: registros de actividad del sistema
- Tareas programadas: automatización de tareas
- Monitoreo: supervisión de recursos (CPU, RAM, disco)
- Rendimiento: optimización de recursos del sistema
- Automatización: scripts para tareas repetitivas

18. DESARROLLO WEB:
- Responsive design: diseño que se adapta a dispositivos
- Accesibilidad: diseño para usuarios con discapacidades
- UX/UI: experiencia e interfaz de usuario
- Optimización: velocidad, SEO, rendimiento
- Validaciones: verificar datos antes de enviar
- Seguridad web: XSS, SQL injection, CSRF
- Autenticación: login, sesiones, tokens
- Paneles administrativos: CMS, dashboards

Tu función como asistente:
1. Diagnosticar problemas de hardware, software, redes y periféricos
2. Sugerir soluciones paso a paso de manera clara y detallada
3. Dar recomendaciones y advertencias de seguridad
4. Explicar conceptos técnicos de forma accesible
5. Ayudar a redactar reportes técnicos profesionales
6. Proporcionar información educativa sobre tecnología

Responde SIEMPRE en español. Usa formato claro con secciones:
🔍 DIAGNÓSTICO: [análisis del problema]
🛠️ PASOS DE SOLUCIÓN: [pasos numerados y detallados]
⚠️ ADVERTENCIAS: [precauciones de seguridad si aplica]
💡 RECOMENDACIÓN FINAL: [consejos adicionales]

Sé preciso, técnico pero accesible para estudiantes de escuela técnica.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemPrompt + "\n\nEl usuario tiene el siguiente problema técnico: " + problem
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1500
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error API:', response.status, errorText);
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMsg += ': ' + (errorData.error?.message || errorData.message || errorText.substring(0, 100));
      } catch(e) {
        errorMsg += ': ' + errorText.substring(0, 100);
      }
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    console.log('API Response:', data);
    
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No se pudo obtener respuesta. Verifica tu conexión.';
    aiLastResponse = reply;

    const loadingNode = document.getElementById(loadId);
    if (loadingNode) loadingNode.remove();

    const formatted = escHtml(reply)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    chatArea.innerHTML += `
      <div class="ai-message ai">
        <div class="ai-bubble">${formatted}</div>
        <div class="ai-meta">Asistente COMPUTEC · ${new Date().toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `;
  } catch (err) {
    console.error('Error en IA:', err);
    const loadingNode = document.getElementById(loadId);
    if (loadingNode) loadingNode.remove();

    chatArea.innerHTML += `
      <div class="ai-message ai">
        <div class="ai-bubble" style="border-left:3px solid var(--red)">
          ⚠️ Error al conectar con la IA.<br><br>
          <small>Detalle: ${escHtml(err.message)}</small>
        </div>
      </div>
    `;
  }

  sendBtn.disabled = false;
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ======================== HELPERS ========================
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function statusColor(status) {
  return {
    resuelto: '#10b981',
    en_proceso: '#f59e0b',
    pendiente: '#ef4444'
  }[status] || '#3b82f6';
}

function statusBadge(status) {
  const map = {
    resuelto: ['badge-green', '✅ Resuelto'],
    en_proceso: ['badge-yellow', '⏳ En Proceso'],
    pendiente: ['badge-red', '🔴 Pendiente']
  };

  const [cls, label] = map[status] || ['badge-blue', status || 'Sin estado'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function priorityBadge(priority) {
  if (!priority || priority === 'normal') return '';
  const map = {
    alta: ['badge-orange', '🔥 Alta'],
    urgente: ['badge-red', '🚨 Urgente'],
    baja: ['badge-blue', '🔵 Baja']
  };

  const [cls, label] = map[priority] || ['badge-blue', priority];
  return `<span class="badge ${cls}">${label}</span>`;
}

function showToast(msg, type = 'info') {
  const icon = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }[type] || 'ℹ️';

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-text">${msg}</span>`;
  document.getElementById('toast-container').appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = '.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ======================== EVENTS ========================
document.addEventListener('keydown', e => {
  const loginVisible = !document.getElementById('login-screen').classList.contains('hidden');
  if (e.key === 'Enter' && loginVisible) {
    doLogin();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  const aiInput = document.getElementById('ai-input');
  if (aiInput) {
    aiInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendToAI();
      }
    });
  }

  const alreadyLogged = localStorage.getItem('computec_logged_in') === 'true';
  if (alreadyLogged) {
    await loadCredentials();
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    initApp();
  }
});