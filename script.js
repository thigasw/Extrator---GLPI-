let chamados = [];
let chamadosPorTecnico = {};
let tecnicoSelecionado = "TODOS";

function lerCSV() {
  const input = document.getElementById("csvFile");
  const file = input.files[0];

  if (!file) {
    alert("Selecione um arquivo CSV!");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => processarCSV(e.target.result);
  reader.readAsText(file, "UTF-8");
}

function normalizarTexto(txt) {
  return txt
    .replace(/^\uFEFF/, "")
    .replaceAll('"', "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function splitCSVLine(line, separator) {
  const result = [];
  let current = "";
  let insideQuotes = false;

  for (let char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }
    if (char === separator && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result.map((v) => v.trim());
}

function parseData(dataStr) {
  if (!dataStr) return null;

  const txt = dataStr.trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(txt)) {
    return new Date(txt.replace(" ", "T"));
  }

  if (/^\d{2}\/\d{2}\/\d{4}/.test(txt)) {
    const partes = txt.split(" ");
    const [dia, mes, ano] = partes[0].split("/");

    let hh = "00",
      mm = "00",
      ss = "00";
    if (partes[1]) {
      const t = partes[1].split(":");
      hh = t[0] || "00";
      mm = t[1] || "00";
      ss = t[2] || "00";
    }

    return new Date(`${ano}-${mes}-${dia}T${hh}:${mm}:${ss}`);
  }

  const d = new Date(txt);
  return isNaN(d.getTime()) ? null : d;
}

function diferencaDias(dataInicio, dataFim) {
  const msPorDia = 1000 * 60 * 60 * 24;
  const diffMs = dataFim - dataInicio;
  return Math.floor(diffMs / msPorDia);
}

function parsePrazoDias(valor) {
  if (!valor) return 0;

  const v = valor.toString().trim().toLowerCase();

  if (/^\d+(\.\d+)?$/.test(v)) return parseFloat(v);

  const matchDias = v.match(/(\d+)\s*dia/);
  if (matchDias) return parseInt(matchDias[1]);

  const matchHoras = v.match(/(\d+)\s*hora/);
  if (matchHoras) return Math.ceil(parseInt(matchHoras[1]) / 24);

  const matchTempo = v.match(/^(\d+):(\d+)/);
  if (matchTempo) {
    const hh = parseInt(matchTempo[1]);
    return Math.ceil(hh / 24);
  }

  return 0;
}

function limparTecnico(valor) {
  if (!valor) return "Não atribuído";

  let t = valor.toString().trim();

  t = t.replace(/<br\s*\/?>/gi, " ");

  t = t.replace(/\s+/g, " ").trim();

  t = t.replace(/:\s*\d+\s*chamado\(s\)\s*$/i, "").trim();

  if (t.includes(":")) {
    t = t.split(":")[0].trim();
  }

  const partes = t
    .split(/[\n;,]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (partes.length > 0) {
    t = partes[0];
  }

  if (!t) return "Não atribuído";
  return t;
}

function processarCSV(conteudo) {
  chamados = [];
  chamadosPorTecnico = {};
  tecnicoSelecionado = "TODOS";

  const separador = conteudo.includes(";") ? ";" : ",";
  const linhas = conteudo.split(/\r?\n/).filter((l) => l.trim() !== "");

  if (linhas.length < 2) {
    alert("CSV vazio ou inválido!");
    return;
  }

  const cabecalho = splitCSVLine(linhas[0], separador).map(normalizarTexto);

  let idxID = -1;
  let idxTecnico = -1;
  let idxTitulo = -1;
  let idxAbertura = -1;
  let idxPrazo = -1;

  cabecalho.forEach((col, i) => {
    if (col === "id") idxID = i;

    if (col.includes("atribuido") && col.includes("tecnico")) {
      idxTecnico = i;
    }

    if (
      col === "titulo" ||
      col === "assunto" ||
      col === "nome" ||
      col.includes("titulo")
    ) {
      idxTitulo = i;
    }

    if (
      col.includes("data de abertura") ||
      col.includes("abertura") ||
      col.includes("data abertura") ||
      col.includes("criado em") ||
      col.includes("criada em")
    ) {
      idxAbertura = i;
    }

    if (
      col.includes("tempo para solucao") ||
      col.includes("tempo p/ solucao") ||
      col.includes("prazo") ||
      col.includes("sla") ||
      col.includes("tempo solucao")
    ) {
      idxPrazo = i;
    }
  });

  if (
    idxID === -1 ||
    idxTecnico === -1 ||
    idxTitulo === -1 ||
    idxAbertura === -1
  ) {
    alert(
      "Não foi possível identificar colunas obrigatórias.\n\n" +
        "Precisa existir no CSV:\n" +
        "- ID\n- Atribuído - Técnico\n- Título\n- Data de abertura\n\n" +
        "Colunas encontradas:\n" +
        cabecalho.join(" | "),
    );
    return;
  }

  const hoje = new Date();

  for (let i = 1; i < linhas.length; i++) {
    const campos = splitCSVLine(linhas[i], separador);
    const id = (campos[idxID] || "").trim();
    let tecnico = limparTecnico(campos[idxTecnico] || "");
    const titulo = (campos[idxTitulo] || "").trim();

    const aberturaStr = (campos[idxAbertura] || "").trim();
    const abertura = parseData(aberturaStr);

    const prazoStr = idxPrazo !== -1 ? (campos[idxPrazo] || "").trim() : "";
    const prazoDias = parsePrazoDias(prazoStr);

    if (!id) continue;

    let diasEmAtendimento = 0;
    if (abertura) {
      diasEmAtendimento = diferencaDias(abertura, hoje);
      if (diasEmAtendimento < 0) diasEmAtendimento = 0;
    }

    let diasAtraso = 0;
    if (prazoDias > 0) {
      diasAtraso = diasEmAtendimento - prazoDias;
      if (diasAtraso < 0) diasAtraso = 0;
    }

    chamados.push({
      id,
      tecnico,
      titulo,
      aberturaStr,
      prazoDias,
      diasEmAtendimento,
      diasAtraso,
    });

    chamadosPorTecnico[tecnico] = (chamadosPorTecnico[tecnico] || 0) + 1;
  }

  atualizarSelectTecnicos();
  atualizarTabelaChamados();
  atualizarTabelaTecnicos();
}

function atualizarSelectTecnicos() {
  const select = document.getElementById("filtroTecnico");
  select.innerHTML = `<option value="TODOS">Todos</option>`;

  Object.keys(chamadosPorTecnico)
    .sort()
    .forEach((tecnico) => {
      const option = document.createElement("option");
      option.value = tecnico;
      option.textContent = tecnico;
      select.appendChild(option);
    });

  select.value = "TODOS";
}

function filtrarPorTecnico() {
  tecnicoSelecionado = document.getElementById("filtroTecnico").value;
  atualizarTabelaChamados();
}

function atualizarTabelaChamados() {
  const tbody = document.querySelector("#tabela tbody");
  tbody.innerHTML = "";

  let lista = chamados;
  if (tecnicoSelecionado !== "TODOS") {
    lista = chamados.filter((c) => c.tecnico === tecnicoSelecionado);
  }

  lista.forEach((item) => {
    const tr = document.createElement("tr");

    const atrasoStyle =
      item.diasAtraso > 0 ? "font-weight:bold; color:#b91c1c;" : "";

    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${item.tecnico}</td>
      <td>${item.titulo}</td>
      <td>${item.aberturaStr}</td>
      <td>${item.prazoDias}</td>
      <td>${item.diasEmAtendimento}</td>
      <td style="${atrasoStyle}">${item.diasAtraso}</td>
    `;

    tbody.appendChild(tr);
  });
}

function atualizarTabelaTecnicos() {
  let divResumo = document.getElementById("resumoTecnicos");

  if (!divResumo) {
    divResumo = document.createElement("div");
    divResumo.id = "resumoTecnicos";
    divResumo.style.marginTop = "25px";
    document.querySelector(".container").appendChild(divResumo);
  }

  const listaOrdenada = Object.entries(chamadosPorTecnico).sort(
    (a, b) => b[1] - a[1],
  );

  let html = `
    <h2>Quantidade de chamados por Analista</h2>
    <table style="width:100%; border-collapse:collapse;">
      <thead style="background:#e5e7eb;">
        <tr>
          <th style="padding:10px; border:1px solid #d1d5db;">Técnico</th>
          <th style="padding:10px; border:1px solid #d1d5db;">Qtd</th>
        </tr>
      </thead>
      <tbody>
  `;

  listaOrdenada.forEach(([tec, qtd]) => {
    html += `
      <tr>
        <td style="padding:10px; border:1px solid #d1d5db;">${tec}</td>
        <td style="padding:10px; border:1px solid #d1d5db;">${qtd}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  divResumo.innerHTML = html;
}

function exportarTXT() {
  if (!chamados.length) {
    alert("Nenhum dado para exportar.");
    return;
  }

  let conteudo = "Resumo de chamados por analista\n\n";


  Object.entries(chamadosPorTecnico)
    .sort((a, b) => b[1] - a[1])
    .forEach(([analista, qtd]) => {
      conteudo += `${analista}: ${qtd} chamado(s)\n`;
    });

  conteudo += "\n";

 
  let listaFiltrada = chamados;

  if (tecnicoSelecionado !== "TODOS") {
    listaFiltrada = chamados.filter(
      (c) => c.tecnico === tecnicoSelecionado
    );
  }

 
  const chamadosAgrupados = {};

  listaFiltrada.forEach((c) => {
    if (!chamadosAgrupados[c.tecnico]) {
      chamadosAgrupados[c.tecnico] = [];
    }
    chamadosAgrupados[c.tecnico].push(c);
  });

  
  Object.keys(chamadosAgrupados)
    .sort()
    .forEach((analista) => {
      conteudo += "---------------------------------\n";
      conteudo += `Chamados do analista: ${analista}\n\n`;

      chamadosAgrupados[analista].forEach((c) => {
        conteudo +=
          `ID: ${c.id} | ` +
          `Analista: ${c.tecnico} | ` +
          `Título: ${c.titulo} | ` +
          `Abertura: ${c.aberturaStr} | ` +
          `Em atendimento: ${c.diasEmAtendimento} dia(s) | ` +
          `Atraso: ${c.diasAtraso} dia(s)\n`;
      });

      conteudo += "\n";
    });

  const blob = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download =
    tecnicoSelecionado === "TODOS"
      ? "chamados_por_analista.txt"
      : `chamados_${tecnicoSelecionado.replace(/\s+/g, "_")}.txt`;

  a.click();
  URL.revokeObjectURL(url);
}