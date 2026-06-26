Chart.register(ChartDataLabels);
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.color = "#64748b";

const colorPalette = [
    '#1a73e8', '#ea4335', '#34a853', '#fbbc04', '#8b5cf6',
    '#ec4899', '#14b8a6', '#6366f1', '#f43f5e', '#84cc16',
    '#f97316', '#06b6d4'
];
const barColor = '#ea4335';
const barColor2 = '#34a853';
const lineColor = '#1a73e8';

let chartInstances = {};
let allData = [];
let filteredData = [];

// Monthly comparison data (populated in processData)
let monthlyCompareData = null;

// Custom Datepicker State Variables
let absMinDate = null;
let absMaxDate = null;
let selectedStart = null;
let selectedEnd = null;
let tempStart = null;
let tempEnd = null;
let currentMonth = null;
let currentYear = null;

function parseDate(str) {
    if (!str) return null;
    const raw = str.split(' ')[0].trim();
    if (!raw) return null;
    
    // Check for DD/MM/YYYY
    let parts = raw.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return { day, month, year, date: new Date(year, month - 1, day) };
        }
    }
    
    // Check for YYYY-MM-DD
    parts = raw.split('-');
    if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY-MM-DD
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const day = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                return { day, month, year, date: new Date(year, month - 1, day) };
            }
        } else { // DD-MM-YYYY
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                return { day, month, year, date: new Date(year, month - 1, day) };
            }
        }
    }
    
    return null;
}

function formatDateToISO(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateToBR(date) {
    if (!date) return '';
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}
function updateCSVPeriodMetric() {
    let csvStartDateStr = '';
    let csvEndDateStr = '';
    let csvDiffDays = 0;
    
    if (absMinDate && absMaxDate) {
        csvStartDateStr = formatDateToBR(absMinDate);
        csvEndDateStr = formatDateToBR(absMaxDate);
        const timeDiff = Math.abs(absMaxDate.getTime() - absMinDate.getTime());
        csvDiffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    }

    const metricPeriodoDias = document.getElementById('metric-periodo-dias');
    const metricPeriodoDatas = document.getElementById('metric-periodo-datas');
    if (metricPeriodoDias && metricPeriodoDatas) {
        if (csvDiffDays > 0) {
            metricPeriodoDias.textContent = csvDiffDays + (csvDiffDays === 1 ? ' dia' : ' dias');
            metricPeriodoDatas.textContent = `${csvStartDateStr} a ${csvEndDateStr}`;
        } else {
            metricPeriodoDias.textContent = 'n/d';
            metricPeriodoDatas.textContent = 'Sem dados';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const stored = sessionStorage.getItem('nqsp_data');
    if (stored) {
        allData = JSON.parse(stored);
        populateFilterOptions();
        applyFilters();
    }

    document.getElementById('btn-apply-filter').addEventListener('click', applyFilters);
    document.getElementById('btn-reset-filter').addEventListener('click', resetFilters);
    document.getElementById('btn-back').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.href = 'index.html';
    });

    document.getElementById('btn-export-pdf').addEventListener('click', exportPDF);
    document.getElementById('btn-export-img').addEventListener('click', exportImage);
    
    initCustomDatePicker();
    setupChartZoom();
});

function populateFilterOptions() {
    const stored = sessionStorage.getItem('nqsp_data');
    if (!stored) return;
    const data = JSON.parse(stored);
    const filename = sessionStorage.getItem('nqsp_filename') || '';

    if (filename) {
        document.getElementById('last-update').textContent = filename;
    }

    const startInput = document.getElementById('filter-date-start');
    const endInput = document.getElementById('filter-date-end');

    // Find absolute min/max dates across ALL data (full CSV range)
    absMinDate = null;
    absMaxDate = null;
    data.forEach(row => {
        const rawDate = row['Criado em'] || row['Data de Registro'];
        const parsed = parseDate(rawDate);
        if (parsed) {
            const d = parsed.date;
            if (!absMinDate || d < absMinDate) absMinDate = d;
            if (!absMaxDate || d > absMaxDate) absMaxDate = d;
        }
    });

    // Set default date range filter from the absolute min/max dates
    if (absMinDate && absMaxDate) {
        selectedStart = absMinDate;
        selectedEnd = absMaxDate;

        startInput.value = formatDateToISO(selectedStart);
        endInput.value = formatDateToISO(selectedEnd);
        
        startInput.min = formatDateToISO(absMinDate);
        startInput.max = formatDateToISO(absMaxDate);
        endInput.min = formatDateToISO(absMinDate);
        endInput.max = formatDateToISO(absMaxDate);

        const labelEl = document.getElementById('datepicker-label');
        if (labelEl) {
            labelEl.textContent = `${formatDateToBR(selectedStart)} a ${formatDateToBR(selectedEnd)}`;
        }
    }

    updateCSVPeriodMetric();

    const setores = [...new Set(data.map(r => r['Setor Notificado']).filter(Boolean))].sort();
    const turnos = [...new Set(data.map(r => r['Turno do Ocorrido:']).filter(Boolean))].sort();

    const setorSelect = document.getElementById('filter-setor');
    setorSelect.innerHTML = '<option value="">Todos os Setores</option>';
    setores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        setorSelect.appendChild(opt);
    });

    const turnoSelect = document.getElementById('filter-turno');
    turnoSelect.innerHTML = '<option value="">Todos</option>';
    turnos.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        turnoSelect.appendChild(opt);
    });
}

function applyFilters() {
    const stored = sessionStorage.getItem('nqsp_data');
    if (!stored) return;
    allData = JSON.parse(stored);

    const setor = document.getElementById('filter-setor').value;
    const turno = document.getElementById('filter-turno').value;
    const dateStart = document.getElementById('filter-date-start').value;
    const dateEnd = document.getElementById('filter-date-end').value;

    let ds = null;
    let de = null;
    if (dateStart && dateEnd) {
        const p1 = dateStart.split('-');
        const d1 = new Date(p1[0], p1[1] - 1, p1[2]);
        d1.setHours(0, 0, 0, 0);
        
        const p2 = dateEnd.split('-');
        const d2 = new Date(p2[0], p2[1] - 1, p2[2]);
        d2.setHours(0, 0, 0, 0);
        
        ds = d1 < d2 ? d1 : d2;
        de = d1 > d2 ? d1 : d2;
    } else if (dateStart) {
        const p1 = dateStart.split('-');
        ds = new Date(p1[0], p1[1] - 1, p1[2]);
        ds.setHours(0, 0, 0, 0);
    } else if (dateEnd) {
        const p2 = dateEnd.split('-');
        de = new Date(p2[0], p2[1] - 1, p2[2]);
        de.setHours(0, 0, 0, 0);
    }

    filteredData = allData.filter(row => {
        if (setor && row['Setor Notificado'] !== setor) return false;
        if (turno && row['Turno do Ocorrido:'] !== turno) return false;
        if (ds || de) {
            const dateStr = row['Data de Registro'] || row['Criado em'];
            if (!dateStr) return false;
            const parsed = parseDate(dateStr);
            if (!parsed) return false;
            const d = parsed.date;
            d.setHours(0, 0, 0, 0);

            if (ds && d < ds) return false;
            if (de && d > de) return false;
        }
        return true;
    });

    processData(filteredData);
    updateCSVPeriodMetric();
}

function resetFilters() {
    document.getElementById('filter-setor').value = '';
    document.getElementById('filter-turno').value = '';
    
    const stored = sessionStorage.getItem('nqsp_data');
    if (stored) {
        const data = JSON.parse(stored);
        if (data.length > 0) {
            const firstRow = data[0];
            const lastRow = data[data.length - 1];
            
            const dateStr1 = firstRow['Data de Registro'] || firstRow['Criado em'];
            const dateStr2 = lastRow['Data de Registro'] || lastRow['Criado em'];
            
            const parsed1 = parseDate(dateStr1);
            const parsed2 = parseDate(dateStr2);
            
            if (parsed1 && parsed2) {
                selectedStart = parsed1.date;
                selectedEnd = parsed2.date;
            } else if (parsed1) {
                selectedStart = parsed1.date;
                selectedEnd = parsed1.date;
            } else if (parsed2) {
                selectedStart = parsed2.date;
                selectedEnd = parsed2.date;
            }
            
            if (selectedStart && selectedEnd) {
                document.getElementById('filter-date-start').value = formatDateToISO(selectedStart);
                document.getElementById('filter-date-end').value = formatDateToISO(selectedEnd);
                
                const labelEl = document.getElementById('datepicker-label');
                if (labelEl) {
                    labelEl.textContent = `${formatDateToBR(selectedStart)} a ${formatDateToBR(selectedEnd)}`;
                }
            } else {
                document.getElementById('filter-date-start').value = '';
                document.getElementById('filter-date-end').value = '';
                const labelEl = document.getElementById('datepicker-label');
                if (labelEl) labelEl.textContent = 'Selecionar período';
            }
        } else {
            document.getElementById('filter-date-start').value = '';
            document.getElementById('filter-date-end').value = '';
            const labelEl = document.getElementById('datepicker-label');
            if (labelEl) labelEl.textContent = 'Selecionar período';
        }
    } else {
        document.getElementById('filter-date-start').value = '';
        document.getElementById('filter-date-end').value = '';
        const labelEl = document.getElementById('datepicker-label');
        if (labelEl) labelEl.textContent = 'Selecionar período';
    }
    applyFilters();
}

function processData(data) {
    const total = data.length;
    document.getElementById('metric-total').textContent = total;
    document.getElementById('total-records').textContent = total + ' registros';

    const statusCounts = countByProperty(data, 'Status');
    const sortedStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

    const concluido = sortedStatus.find(s => s[0].toLowerCase().includes('conclu')) || ['', 0];
    const pendente = sortedStatus.find(s => s[0].toLowerCase().includes('pendente') || s[0].toLowerCase().includes('aberto')) || ['', 0];

    document.getElementById('metric-concluido').textContent = concluido[1] || 0;
    document.getElementById('metric-pendente').textContent = pendente[1] || 0;

    const setores = countByProperty(data, 'Setor Notificado');
    document.getElementById('metric-setores').textContent = Object.keys(setores).length;

    populateStatusTable(sortedStatus);
    createPieChart('chart-status-pie', sortedStatus, colorPalette);

    const setorNotificado = countByProperty(data, 'Setor Notificado');
    const sortedSetorNotificado = Object.entries(setorNotificado).sort((a, b) => b[1] - a[1]).slice(0, 10);
    createBarChart('chart-setor-notificado', sortedSetorNotificado, barColor, true);

    const setorNotificador = countByProperty(data, 'Setor Notificante');
    const sortedSetorNotificador = Object.entries(setorNotificador).sort((a, b) => b[1] - a[1]).slice(0, 10);
    createBarChart('chart-setor-notificador', sortedSetorNotificador, barColor2, true);

    // Linha do Tempo (Registro vs. Ocorrência)
    const regMonthCounts = {};
    const occMonthCounts = {};
    const allMonths = new Set();

    data.forEach(row => {
        const regRaw = row['Data de Registro'] || row['Criado em'];
        const occRaw = row['Data do Ocorrido']; // Normalized key

        const regParsed = parseDate(regRaw);
        const occParsed = parseDate(occRaw);

        if (regParsed) {
            const mKey = `${String(regParsed.month).padStart(2, '0')}/${regParsed.year}`;
            regMonthCounts[mKey] = (regMonthCounts[mKey] || 0) + 1;
            allMonths.add(mKey);
        }
        if (occParsed) {
            const mKey = `${String(occParsed.month).padStart(2, '0')}/${occParsed.year}`;
            occMonthCounts[mKey] = (occMonthCounts[mKey] || 0) + 1;
            allMonths.add(mKey);
        }
    });

    const sortedMonthKeys = Array.from(allMonths).sort((a, b) => {
        const pa = a.split('/');
        const pb = b.split('/');
        return new Date(pa[1], pa[0] - 1) - new Date(pb[1], pb[0] - 1);
    });

    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const timelineLabels = sortedMonthKeys.map(mk => {
        const p = mk.split('/');
        return `${meses[parseInt(p[0]) - 1] || p[0]}/${p[1]}`;
    });

    const creationTimelineData = sortedMonthKeys.map(mk => regMonthCounts[mk] || 0);
    const occurrenceTimelineData = sortedMonthKeys.map(mk => occMonthCounts[mk] || 0);

    createCompareTimelineChart('chart-timeline', timelineLabels, creationTimelineData, occurrenceTimelineData);

    monthlyCompareData = {
        sortedMonthKeys,
        timelineLabels,
        regMonthCounts,
        occMonthCounts
    };

    const classificacao = countByProperty(data, 'Classificação da Ocorrência');
    const sortedClass = Object.entries(classificacao).sort((a, b) => b[1] - a[1]);
    createBarChart('chart-classificacao', sortedClass, '#4285f4', true);

    const tipoNC = countByProperty(data, 'Tipo de Não Conformidade');
    const sortedTipo = Object.entries(tipoNC).sort((a, b) => b[1] - a[1]);
    createBarChart('chart-tipo-nc', sortedTipo, '#8b5cf6', true);

    const impacto = countByProperty(data, 'Impacto no Processo');
    const sortedImpacto = Object.entries(impacto).sort((a, b) => b[1] - a[1]);
    createPieChart('chart-impacto', sortedImpacto, colorPalette);

    const consequencia = countByProperty(data, 'Consequência do dano');
    const sortedCons = Object.entries(consequencia).sort((a, b) => b[1] - a[1]);
    createPieChart('chart-consequencia', sortedCons, colorPalette);

    const risco = countByProperty(data, 'Classificação do Risco');
    const sortedRisco = Object.entries(risco).sort((a, b) => b[1] - a[1]);
    createBarChart('chart-risco', sortedRisco, ['#34a853', '#fbbc04', '#ea4335'], true);
}

function countByProperty(data, prop) {
    return data.reduce((acc, row) => {
        let val = row[prop];
        if (!val || val.trim() === '') val = 'n/d';
        acc[val] = (acc[val] || 0) + 1;
        return acc;
    }, {});
}

function countByDate(data, prop) {
    return data.reduce((acc, row) => {
        let val = row[prop];
        if (!val || val.trim() === '') return acc;
        const raw = val.split(' ')[0].trim();
        let datePart = raw;
        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
            const p = raw.split('-');
            datePart = `${p[2]}/${p[1]}/${p[0]}`;
        }
        acc[datePart] = (acc[datePart] || 0) + 1;
        return acc;
    }, {});
}

function populateStatusTable(sortedData) {
    const tbody = document.querySelector('#status-table tbody');
    tbody.innerHTML = '';
    sortedData.forEach(([status, count]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${status}</td><td>${count}</td>`;
        tbody.appendChild(tr);
    });
}

function destroyChart(id) {
    if (chartInstances[id]) {
        chartInstances[id].destroy();
        delete chartInstances[id];
    }
}

function createPieChart(id, sortedData, colors) {
    destroyChart(id);
    const el = document.getElementById(id);
    if (!el) return;
    const ctx = el.getContext('2d');

    const labels = sortedData.map(i => i[0]);
    const data = sortedData.map(i => i[1]);

    chartInstances[id] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 1,
                borderColor: '#f1f5f9'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 10,
                        font: { size: 11 },
                        padding: 12
                    }
                },
                datalabels: {
                    formatter: (value, ctx) => {
                        const sum = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        return (value * 100 / sum) > 5 ? (value * 100 / sum).toFixed(1) + '%' : null;
                    },
                    color: '#fff',
                    font: { weight: 'bold', size: 11 }
                }
            }
        }
    });
}

function createBarChart(id, sortedData, color, useColorArray = false) {
    destroyChart(id);
    const el = document.getElementById(id);
    if (!el || sortedData.length === 0) return;
    const ctx = el.getContext('2d');

    const labels = sortedData.map(i => {
        const p = i[0].split(/[\/\-]/);
        if (p.length === 3) return `${parseInt(p[0])}/${p[1]}`;
        return i[0].length > 18 ? i[0].substring(0, 18) + '...' : i[0];
    });
    const data = sortedData.map(i => i[1]);

    chartInstances[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: useColorArray ? color : color,
                borderRadius: 3,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#64748b',
                    font: { size: 10, weight: 'bold' },
                    formatter: v => v > 0 ? v : ''
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { maxRotation: 35, font: { size: 10 } } }
            }
        }
    });
}

function createLineChart(id, sortedData, color) {
    destroyChart(id);
    const el = document.getElementById(id);
    if (!el || sortedData.length === 0) return;
    const ctx = el.getContext('2d');

    const labels = sortedData.map(i => {
        const p = i[0].split(/[\/\-]/);
        return p.length === 3 ? `${parseInt(p[0])}/${p[1]}` : i[0];
    });
    const data = sortedData.map(i => i[1]);

    chartInstances[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: color,
                pointBorderColor: '#fff',
                pointBorderWidth: 1.5,
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                datalabels: { display: false }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { maxRotation: 0, maxTicksLimit: 12, font: { size: 10 } } }
            }
        }
    });
}

function createCompareTimelineChart(id, labels, creationData, occurrenceData) {
    destroyChart(id);
    const el = document.getElementById(id);
    if (!el) return;
    const ctx = el.getContext('2d');

    function calcPct(data, i) {
        if (i === 0) return null;
        const prev = data[i - 1];
        if (prev === 0) return creationData[i] > 0 ? 100 : 0;
        return ((data[i] - prev) / prev) * 100;
    }

    chartInstances[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Registros',
                    data: creationData,
                    backgroundColor: creationData.map((v, i) => {
                        if (i === 0) return '#1a73e8';
                        const pct = calcPct(creationData, i);
                        return pct !== null && pct < 0 ? '#ea4335' : '#34a853';
                    }),
                    borderRadius: 3,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        font: { size: 10, weight: '500' }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    font: { size: 10, weight: 'bold' },
                    formatter: (value, ctx) => {
                        const i = ctx.dataIndex;
                        if (i === 0) return `${value}`;
                        const pct = calcPct(creationData, i);
                        if (pct === null) return `${value}`;
                        const arrow = pct >= 0 ? '▲' : '▼';
                        return `${value}  ${arrow}${Math.abs(pct).toFixed(1)}%`;
                    },
                    color: (ctx) => {
                        const i = ctx.dataIndex;
                        if (i === 0) return '#1a73e8';
                        const pct = calcPct(creationData, i);
                        return pct !== null && pct < 0 ? '#ea4335' : '#34a853';
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                }
            }
        }
    });
}

function snapshotCharts() {
    const isDetailActive = !document.getElementById('chart-detail-view').classList.contains('hidden');
    const content = isDetailActive ? document.getElementById('chart-detail-view') : document.getElementById('dashboard-content');
    const canvases = content.querySelectorAll('canvas');
    const snapshots = [];
    canvases.forEach((c, i) => {
        const ctx = c.getContext('2d');
        let dataUrl = '';
        try {
            dataUrl = c.toDataURL('image/png');
        } catch (e) {
            dataUrl = '';
        }
        snapshots.push({
            index: i,
            dataUrl: dataUrl,
            width: c.offsetWidth || c.clientWidth || 300,
            height: c.offsetHeight || c.clientHeight || 200,
            id: c.id
        });
    });
    return { snapshots, content };
}

async function captureContent() {
    Object.values(chartInstances).forEach(c => {
        if (!c) return;
        c.options.animation = false;
        c.options.transitions = { active: { animation: { duration: 0 } } };
        c.resize();
        c.render({ duration: 0, lazy: false });
        c.draw();
    });
    await new Promise(r => requestAnimationFrame(() => setTimeout(r, 100)));

    const { snapshots } = snapshotCharts();

    const isDetailActive = !document.getElementById('chart-detail-view').classList.contains('hidden');
    const content = isDetailActive ? document.getElementById('chart-detail-view') : document.getElementById('dashboard-content');
    
    const captured = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f1f5f9',
        logging: false,
        onclone: (clonedDoc) => {
            const isDetailActiveCloned = !clonedDoc.getElementById('chart-detail-view').classList.contains('hidden');
            const clonedContent = isDetailActiveCloned ? clonedDoc.getElementById('chart-detail-view') : clonedDoc.getElementById('dashboard-content');
            if (!clonedContent) return;

            // Inject a style block to disable all opacity animations and hardcode colors for html2canvas compatibility
            const style = clonedDoc.createElement('style');
            style.innerHTML = `
                /* Force full opacity and disable animations to prevent washed out/transparent export images */
                .fade-in, #dashboard-content, #chart-detail-view, .chart-card, .metric-card, canvas, img, p, h1, h2, h3, span, div, table, tr, th, td {
                    animation: none !important;
                    transition: none !important;
                    opacity: 1 !important;
                }
                
                /* Override CSS variables for html2canvas variables compatibility */
                body {
                    background-color: #f1f5f9 !important;
                    color: #0f172a !important;
                }
                .page-content {
                    background-color: #f1f5f9 !important;
                }
                .metric-card, .chart-card {
                    background-color: #ffffff !important;
                    border: 1px solid #e2e8f0 !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.06) !important;
                }
                .metric-value {
                    color: #0f172a !important;
                }
                .metric-label {
                    color: #64748b !important;
                }
                .chart-card-header h3 {
                    color: #64748b !important;
                }
                table th {
                    background-color: #fafbfc !important;
                    color: #64748b !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                }
                table td {
                    border-bottom: 1px solid #f1f5f9 !important;
                    color: #0f172a !important;
                }
                .report-header-left h1 {
                    color: #0f172a !important;
                }
                .report-header-left p {
                    color: #64748b !important;
                }
                .topbar-badge {
                    background-color: #e8f0fe !important;
                    color: #1a73e8 !important;
                }
            `;
            clonedDoc.head.appendChild(style);

            // Fix CSS variables not resolving in html2canvas (fallback)
            const clonedRoot = clonedDoc.documentElement;
            clonedRoot.style.setProperty('--sidebar-bg', '#1e293b');
            clonedRoot.style.setProperty('--sidebar-hover', '#334155');
            clonedRoot.style.setProperty('--sidebar-active', '#0f172a');
            clonedRoot.style.setProperty('--bg', '#f1f5f9');
            clonedRoot.style.setProperty('--card', '#ffffff');
            clonedRoot.style.setProperty('--text', '#0f172a');
            clonedRoot.style.setProperty('--text-muted', '#64748b');
            clonedRoot.style.setProperty('--text-sidebar', '#94a3b8');
            clonedRoot.style.setProperty('--primary', '#1a73e8');
            clonedRoot.style.setProperty('--primary-hover', '#1557b0');
            clonedRoot.style.setProperty('--accent', '#ea4335');
            clonedRoot.style.setProperty('--success', '#34a853');
            clonedRoot.style.setProperty('--warning', '#fbbc04');
            clonedRoot.style.setProperty('--border', '#e2e8f0');

            // Hide the custom datepicker dropdown in the capture (in case it is open)
            const datepickerDropdown = clonedDoc.getElementById('datepicker-dropdown');
            if (datepickerDropdown) {
                datepickerDropdown.style.setProperty('display', 'none', 'important');
            }

            if (isDetailActiveCloned) {
                // Hide back button and compare bar in export
                const backBtn = clonedContent.querySelector('#btn-detail-back');
                if (backBtn) backBtn.style.setProperty('display', 'none', 'important');
                const compareBar = clonedContent.querySelector('#compare-bar');
                if (compareBar) compareBar.style.setProperty('display', 'none', 'important');
            } else {
                // Hide the document name row completely in the capture
                const nameRow = clonedContent.querySelector('.report-name-row');
                if (nameRow) {
                    nameRow.style.setProperty('display', 'none', 'important');
                }

                // Hide the uploaded CSV file name in the capture subtitle
                const lastUpdate = clonedContent.querySelector('#last-update');
                if (lastUpdate) {
                    lastUpdate.textContent = '';
                    const parent = lastUpdate.parentElement;
                    if (parent) {
                        parent.innerHTML = parent.innerHTML.replace('—', '').trim();
                    }
                }
            }

            const clonedCanvases = clonedContent.querySelectorAll('canvas');
            clonedCanvases.forEach((clonedCanvas, i) => {
                const snap = snapshots.find(s => s.index === i || s.id === clonedCanvas.id);
                if (!snap || !snap.dataUrl) return;

                const img = clonedDoc.createElement('img');
                img.src = snap.dataUrl;
                img.style.width = snap.width + 'px';
                img.style.height = snap.height + 'px';

                clonedCanvas.parentNode.replaceChild(img, clonedCanvas);
            });
        }
    });

    return captured;
}

async function exportPDF() {
    const btn = document.getElementById('btn-export-pdf');
    const origHTML = btn.innerHTML;
    btn.innerHTML = '⏳ Gerando PDF...';
    btn.style.pointerEvents = 'none';

    try {
        const canvas = await captureContent();
        const { jsPDF } = window.jspdf;

        const pxToMm = 0.264583;
        const wMm = canvas.width * pxToMm;
        const hMm = canvas.height * pxToMm;

        const doc = new jsPDF({
            orientation: wMm > hMm ? 'l' : 'p',
            unit: 'mm',
            format: [wMm, hMm]
        });

        const reportName = (document.getElementById('report-name')?.value || 'dashboard-nqsp').replace(/[^a-zA-Z0-9_-]/g, '_');
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 0, 0, wMm, hMm);
        doc.save(reportName + '.pdf');
    } finally {
        btn.innerHTML = origHTML;
        btn.style.pointerEvents = '';
    }
}

async function exportImage() {
    const btn = document.getElementById('btn-export-img');
    const origHTML = btn.innerHTML;
    btn.innerHTML = '⏳ Gerando Imagem...';
    btn.style.pointerEvents = 'none';

    try {
        const canvas = await captureContent();
        const reportName = (document.getElementById('report-name')?.value || 'dashboard-nqsp').replace(/[^a-zA-Z0-9_-]/g, '_');
        const link = document.createElement('a');
        link.download = reportName + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    } finally {
        btn.innerHTML = origHTML;
        btn.style.pointerEvents = '';
    }
}

function renderDetailTimeline() {
    if (!monthlyCompareData) return;
    const { sortedMonthKeys, timelineLabels, regMonthCounts, occMonthCounts } = monthlyCompareData;
    const ctx = document.getElementById('chart-detail-canvas').getContext('2d');
    destroyChart('chart-detail-canvas');

    const regData = sortedMonthKeys.map(mk => regMonthCounts[mk] || 0);
    const occData = sortedMonthKeys.map(mk => occMonthCounts[mk] || 0);

    chartInstances['chart-detail-canvas'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: timelineLabels,
            datasets: [
                { label: 'Registros', data: regData, backgroundColor: '#1a73e8', borderRadius: 3, borderSkipped: false },
                { label: 'Ocorrências', data: occData, backgroundColor: '#fbbc04', borderRadius: 3, borderSkipped: false }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
                datalabels: { anchor: 'end', align: 'top', color: '#64748b', font: { size: 9, weight: 'bold' }, formatter: v => v > 0 ? v : '' }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

function populateCompareMonths() {
    if (!monthlyCompareData) return;
    const { sortedMonthKeys } = monthlyCompareData;
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const startSelect = document.getElementById('compare-month-start');
    const endSelect = document.getElementById('compare-month-end');
    startSelect.innerHTML = '';
    endSelect.innerHTML = '';

    sortedMonthKeys.forEach(mk => {
        const p = mk.split('/');
        const label = `${meses[parseInt(p[0]) - 1] || p[0]}/${p[1]}`;
        startSelect.innerHTML += `<option value="${mk}">${label}</option>`;
        endSelect.innerHTML += `<option value="${mk}">${label}</option>`;
    });

    if (sortedMonthKeys.length >= 2) {
        endSelect.value = sortedMonthKeys[sortedMonthKeys.length - 1];
    }
}

function renderCompareResults() {
    if (!monthlyCompareData) return;
    const { sortedMonthKeys, regMonthCounts, occMonthCounts } = monthlyCompareData;
    const startVal = document.getElementById('compare-month-start').value;
    const endVal = document.getElementById('compare-month-end').value;

    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    function monthLabel(mk) {
        const p = mk.split('/');
        return `${meses[parseInt(p[0]) - 1] || p[0]}/${p[1]}`;
    }

    const startReg = regMonthCounts[startVal] || 0;
    const endReg = regMonthCounts[endVal] || 0;
    const startOcc = occMonthCounts[startVal] || 0;
    const endOcc = occMonthCounts[endVal] || 0;

    const regDiff = endReg - startReg;
    const occDiff = endOcc - startOcc;
    const regPct = startReg > 0 ? ((regDiff / startReg) * 100) : 0;
    const occPct = startOcc > 0 ? ((occDiff / startOcc) * 100) : 0;

    function fmtVar(diff, pct) {
        const arrow = diff >= 0 ? '▲' : '▼';
        const color = diff > 0 ? '#ea4335' : diff < 0 ? '#34a853' : '#64748b';
        return { text: `${arrow} ${Math.abs(diff)} (${Math.abs(pct).toFixed(1)}%)`, color };
    }

    document.getElementById('comp-mes1-nome').textContent = monthLabel(startVal);
    document.getElementById('comp-mes1-reg').textContent = startReg;
    document.getElementById('comp-mes1-occ').textContent = startOcc;

    document.getElementById('comp-mes2-nome').textContent = monthLabel(endVal);
    document.getElementById('comp-mes2-reg').textContent = endReg;
    document.getElementById('comp-mes2-occ').textContent = endOcc;

    const r = fmtVar(regDiff, regPct);
    const o = fmtVar(occDiff, occPct);
    document.getElementById('comp-var-reg').textContent = r.text;
    document.getElementById('comp-var-reg').style.color = r.color;
    document.getElementById('comp-var-occ').textContent = o.text;
    document.getElementById('comp-var-occ').style.color = o.color;

    document.getElementById('compare-results').classList.remove('hidden');

    const ctx = document.getElementById('chart-detail-canvas').getContext('2d');
    destroyChart('chart-detail-canvas');

    chartInstances['chart-detail-canvas'] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [monthLabel(startVal), monthLabel(endVal)],
            datasets: [
                { label: 'Registros', data: [startReg, endReg], backgroundColor: '#1a73e8', borderRadius: 3 },
                { label: 'Ocorrências', data: [startOcc, endOcc], backgroundColor: '#fbbc04', borderRadius: 3 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            plugins: {
                legend: { display: true, position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
                datalabels: {
                    anchor: 'end', align: 'top', color: '#64748b', font: { size: 11, weight: 'bold' },
                    formatter: v => v > 0 ? v : ''
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 10 } } }
            }
        }
    });
}

function setupChartZoom() {
    document.querySelectorAll('.chart-card').forEach(card => {
        const header = card.querySelector('.chart-card-header');
        if (!header) return;

        header.addEventListener('click', () => {
            const h3 = header.querySelector('h3');
            const titleText = h3 ? h3.textContent.trim() : 'Gráfico';
            const canvas = card.querySelector('canvas');
            const table = card.querySelector('table');

            // Hide main dashboard content
            document.getElementById('dashboard-content').classList.add('hidden');
            
            // Show detail view
            const detailView = document.getElementById('chart-detail-view');
            detailView.classList.remove('hidden');

            // Set Title
            document.getElementById('detail-chart-title').textContent = titleText;

            const detailChartWrapper = document.getElementById('detail-chart-wrapper');
            const detailTableWrapper = document.getElementById('detail-table-wrapper');
            const compareBar = document.getElementById('compare-bar');
            const compareResults = document.getElementById('compare-results');
            compareBar.classList.add('hidden');
            compareResults.classList.add('hidden');

            if (canvas && canvas.id === 'chart-timeline' && monthlyCompareData) {
                detailChartWrapper.classList.remove('hidden');
                detailTableWrapper.classList.add('hidden');
                destroyChart('chart-detail-canvas');

                // Render the full timeline in detail view
                renderDetailTimeline();

                // Show compare bar and populate months
                compareBar.classList.remove('hidden');
                populateCompareMonths();
                renderCompareResults();

            } else if (canvas) {
                detailChartWrapper.classList.remove('hidden');
                detailTableWrapper.classList.add('hidden');
                destroyChart('chart-detail-canvas');

                const originalChartId = canvas.id;
                const originalChart = chartInstances[originalChartId];
                if (originalChart) {
                    const ctx = document.getElementById('chart-detail-canvas').getContext('2d');
                    const originalOptions = originalChart.config.options || {};
                    
                    chartInstances['chart-detail-canvas'] = new Chart(ctx, {
                        type: originalChart.config.type,
                        data: {
                            labels: [...originalChart.config.data.labels],
                            datasets: originalChart.config.data.datasets.map(d => ({ ...d }))
                        },
                        options: {
                            ...originalOptions,
                            maintainAspectRatio: false
                        }
                    });
                }
            } else if (table) {
                detailChartWrapper.classList.add('hidden');
                detailTableWrapper.classList.remove('hidden');

                const detailTable = document.getElementById('detail-table-content');
                detailTable.innerHTML = table.innerHTML;
            }
        });
    });

    document.getElementById('btn-detail-back').addEventListener('click', () => {
        document.getElementById('chart-detail-view').classList.add('hidden');
        document.getElementById('dashboard-content').classList.remove('hidden');
        destroyChart('chart-detail-canvas');
    });

    document.getElementById('btn-compare-months').addEventListener('click', renderCompareResults);
}

function initCustomDatePicker() {
    const trigger = document.getElementById('datepicker-trigger');
    const dropdown = document.getElementById('datepicker-dropdown');
    const picker = document.getElementById('custom-date-picker');
    
    if (!trigger || !dropdown || !picker) return;

    // Toggle dropdown visibility
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = picker.classList.contains('open');
        if (isOpen) {
            closeDatePicker();
        } else {
            openDatePicker();
        }
    });

    // Revert/Cancel button
    document.getElementById('btn-cal-cancel').addEventListener('click', (e) => {
        e.stopPropagation();
        closeDatePicker();
    });

    // Apply button
    document.getElementById('btn-cal-apply').addEventListener('click', (e) => {
        e.stopPropagation();
        if (tempStart && tempEnd) {
            selectedStart = tempStart;
            selectedEnd = tempEnd;
            
            // Update hidden original input fields
            document.getElementById('filter-date-start').value = formatDateToISO(selectedStart);
            document.getElementById('filter-date-end').value = formatDateToISO(selectedEnd);
            
            // Update trigger label
            document.getElementById('datepicker-label').textContent = `${formatDateToBR(selectedStart)} a ${formatDateToBR(selectedEnd)}`;
            
            closeDatePicker();
            applyFilters();
        }
    });

    // Prev/Next month buttons
    document.getElementById('btn-cal-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        currentMonth--;
        if (currentMonth < 0) {
            currentMonth = 11;
            currentYear--;
        }
        renderCalendarGrid();
    });

    document.getElementById('btn-cal-next').addEventListener('click', (e) => {
        e.stopPropagation();
        currentMonth++;
        if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
        }
        renderCalendarGrid();
    });

    // Clicking outside dropdown closes it
    document.addEventListener('click', (e) => {
        if (!picker.contains(e.target)) {
            closeDatePicker();
        }
    });
}

function openDatePicker() {
    const picker = document.getElementById('custom-date-picker');
    const dropdown = document.getElementById('datepicker-dropdown');
    picker.classList.add('open');
    dropdown.classList.remove('hidden');

    // Parse current hidden input values to initialize selected dates
    const startVal = document.getElementById('filter-date-start').value;
    const endVal = document.getElementById('filter-date-end').value;

    const startParsed = parseDate(startVal);
    const endParsed = parseDate(endVal);

    if (startParsed && endParsed) {
        selectedStart = startParsed.date;
        selectedEnd = endParsed.date;
    }

    tempStart = selectedStart;
    tempEnd = selectedEnd;

    // Default displayed month/year is the max date of the range (or max date of CSV)
    if (tempEnd) {
        currentMonth = tempEnd.getMonth();
        currentYear = tempEnd.getFullYear();
    } else if (absMaxDate) {
        currentMonth = absMaxDate.getMonth();
        currentYear = absMaxDate.getFullYear();
    } else {
        const today = new Date();
        currentMonth = today.getMonth();
        currentYear = today.getFullYear();
    }

    renderCalendarGrid();
    updateDatePickerDisplay();
}

function closeDatePicker() {
    const picker = document.getElementById('custom-date-picker');
    const dropdown = document.getElementById('datepicker-dropdown');
    picker.classList.remove('open');
    dropdown.classList.add('hidden');
}

function updateDatePickerDisplay() {
    const displayEl = document.getElementById('selected-range-display');
    const applyBtn = document.getElementById('btn-cal-apply');
    
    if (tempStart && tempEnd) {
        displayEl.textContent = `${formatDateToBR(tempStart)} a ${formatDateToBR(tempEnd)}`;
        applyBtn.disabled = false;
    } else if (tempStart) {
        displayEl.textContent = `Início: ${formatDateToBR(tempStart)}`;
        applyBtn.disabled = true;
    } else {
        displayEl.textContent = 'Sem período';
        applyBtn.disabled = true;
    }
}

function renderCalendarGrid() {
    const monthsBR = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    document.getElementById('calendar-month-title').textContent = `${monthsBR[currentMonth]} ${currentYear}`;

    const grid = document.getElementById('calendar-days-grid');
    grid.innerHTML = '';

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        const span = document.createElement('span');
        span.className = 'calendar-day empty';
        grid.appendChild(span);
    }

    const dStart = tempStart && tempEnd ? (tempStart < tempEnd ? tempStart : tempEnd) : tempStart;
    const dEnd = tempStart && tempEnd ? (tempStart > tempEnd ? tempStart : tempEnd) : tempEnd;

    for (let day = 1; day <= totalDays; day++) {
        const span = document.createElement('span');
        span.className = 'calendar-day';
        span.textContent = day;

        const cellDate = new Date(currentYear, currentMonth, day);
        cellDate.setHours(0, 0, 0, 0);

        const isBeforeMin = absMinDate && cellDate < new Date(absMinDate.getFullYear(), absMinDate.getMonth(), absMinDate.getDate());
        const isAfterMax = absMaxDate && cellDate > new Date(absMaxDate.getFullYear(), absMaxDate.getMonth(), absMaxDate.getDate());

        if (isBeforeMin || isAfterMax) {
            span.classList.add('disabled');
        } else {
            if (dStart && isSameDay(cellDate, dStart)) {
                span.classList.add('start-date');
            }
            if (dEnd && isSameDay(cellDate, dEnd)) {
                span.classList.add('end-date');
            }
            if (dStart && dEnd && cellDate > dStart && cellDate < dEnd) {
                span.classList.add('in-range');
            }

            span.addEventListener('click', (e) => {
                e.stopPropagation();
                handleCalendarDayClick(cellDate);
            });
        }

        grid.appendChild(span);
    }
}

function handleCalendarDayClick(date) {
    if (!tempStart || (tempStart && tempEnd)) {
        tempStart = date;
        tempEnd = null;
    } else if (tempStart && !tempEnd) {
        if (date < tempStart) {
            tempEnd = tempStart;
            tempStart = date;
        } else {
            tempEnd = date;
        }
    }
    
    renderCalendarGrid();
    updateDatePickerDisplay();
}

function isSameDay(d1, d2) {
    if (!d1 || !d2) return false;
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}
