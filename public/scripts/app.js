"use strict";

const tfExame = document.getElementById("tfExame");
const cbPaciente = document.getElementById("cbPaciente");
const hdExame = document.getElementById("hdExame");
const dtExame = document.getElementById("dtExame");
const cbFaturar = document.getElementById("cbFaturar");
const divResposta = document.getElementById("divResposta");
const pwSenha = document.getElementById("pwSenha");
const SEPARADOR = "##";

var codLocal = null;
var codExecutante = null;
var codExame = null;
var dtPeriodo = null;

var executante = null;
var solicitante = null;
var paciente = null;
var cpf = null;
var exame = null;
var data = null;
var faturar = null;
var senha = null;

var funcaoMD5 = new Function("a", "return md5(a)");

//-----------------------------------------------------------------------------------------//

function tiraEspacos(item) {
  if (item == null) return "";
  var pos = item.length - 1;
  while (item[pos] == " " && pos > 0) pos--;
  return item.substr(0, pos + 1);
}

//-----------------------------------------------------------------------------------------//

function callbackPeriodo() {
  doObterPeriodo().then(retorno => {
    console.log("(app.js) callBackPeriodo retorno", retorno);
    renderObterPeriodo(retorno);
  });
}

//-----------------------------------------------------------------------------------------//

function renderObterPeriodo(data) {
  if (!data) {
    console.log("(app.js) renderObterPeriodo sem conteúdo");
    return;
  }
  if (data.hasOwnProperty("erro")) {
    alert(data.erro);
    return;
  } else {
    console.log("(app.js) renderObterPeriodo -> ", data.Periodo);
    var dia = data.Periodo.substring(0, 2);
    var mes = data.Periodo.substring(3, 5);
    var ano = data.Periodo.substring(6, 10);
    dtPeriodo = ano + "-" + mes + "-" + dia;
  }
}

//-----------------------------------------------------------------------------------------//

function doObterPeriodo() {
  console.log("(app.js) Executando obterPeriodo");
  return fetch("/obterPeriodo/")
    .then(response => {
      console.log("(app.js) obterPeriodo " + response);
      return response.json();
    });
}

//-----------------------------------------------------------------------------------------//

function doVerificarSenha(senha) {
  console.log("(app.js) Executando verificarSenha");
  return fetch("/verificarSenha/" + senha)
    .then(response => {
      console.log("(app.js) verificarSenha response");
      return response.json();
    })
    .catch(() => {
      console.log("(app.js) obterPeriodo catch");
      return;
    });
}

//-----------------------------------------------------------------------------------------//

function callbackObterLocais() {
  doObterLocais().then(retorno => {
    console.log("(app.js) callBackObterLocais retorno", retorno);
    renderObterLocais(retorno);
    callbackPeriodo();
  });
}

//-----------------------------------------------------------------------------------------//

function doObterLocais() {
  return fetch("/obterLocais/")
    .then(response => {
      console.log("(app.js) obterLocais response");
      return response.json();
    })
    .catch(() => {
      console.log("(app.js) obterLocais catch");
      return;
    });
}

//-----------------------------------------------------------------------------------------//

function formatarLocal(item) {
  var returnString =
    "<span style='font-size: 12px; padding: 0px'>" +
    tiraEspacos(item.text) +
    "</span>";
  var novoSpan = document.createElement("span");
  novoSpan.innerHTML = returnString;
  return novoSpan;
}

function renderObterLocais(data) {
  if (!data) {
    console.log("(app.js) renderObterLocais sem conteúdo");
    alert("Erro na conexão com o Servidor #02APP");
    return;
  }
  if (data.hasOwnProperty("erro")) {
    alert(data.erro);
    return;
  } else console.log("(app.js) renderObterLocais -> ", data);

  var arrayLocais = data;

  arrayLocais.sort(function(a, b) {
    var keyA = a.local;
    var keyB = b.local;
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    return 0;
  });

  new Promise((res, rej) => {
    var retorno = "<option value='-1'>Selecione...</option>";

    arrayLocais.forEach((value, index, array) => {
      var codigo = value.codigo;
      var descricao = value.local;
      retorno += "<option value='" + codigo + "'>" + descricao + "</option>";
      if (index === array.length - 1) res(retorno);
    });
  }).then(retorno => {
    const divLocal = document.getElementById("divLocal");
    divLocal.innerHTML =
      "<select id='cbLocal'>" + retorno + "</select></div></form>";
    $("#cbLocal")
      .select2({
        placeholder: "Selecione o local...",
        allowClear: false,
        templateResult: formatarLocal,
        templateSelection: formatarLocal
      })
      .on("select2:select", function(e) {
        codLocal = e.params.data.id;
      });
  });
}

//-----------------------------------------------------------------------------------------//

function callbackConsultarExames() {
  if (codLocal == null) {
    alert("Não foi indicado o local para realização do exame.");
    return;
  }
  tfExame.value = tfExame.value.toUpperCase();
  var strExame = tfExame.value;
  // chama doObterExames e atualiza a tela
  doObterExames(codLocal, strExame).then(retorno => {
    console.log("(app.js) callBackConsultarExames retorno", retorno);
    renderObterExames(retorno);
  });
}

//-----------------------------------------------------------------------------------------//

function doObterExames(local, exame) {
  console.log("(app.js) Executando ObterExames");
  return fetch("/obterExames/" + local + "/" + exame)
    .then(response => {
      console.log("(app.js) ObterExames response");
      return response.json();
    })
    .catch(() => {
      console.log("(app.js) ObterExames catch");
      return null;
    });
}

//-----------------------------------------------------------------------------------------//

function formatarSelecao(item) {
  var returnString;
  if (item.text == "Selecione...")
    returnString =
      "<span style='font-size: 14px;'><br/><b>Selecione...</b></span>";
  else {
    var selectionText = item.text.split(SEPARADOR);
    returnString =
      "<span style='font-size: 12px;'><b>" +
      tiraEspacos(selectionText[0]) +
      "</b><br/>" +
      tiraEspacos(selectionText[1]) +
      "<br/>R$ " +
      tiraEspacos(selectionText[3]) +
      "</span>";
  }
  var novoSpan = document.createElement("span");
  novoSpan.innerHTML = returnString;
  return novoSpan;
}

function formatarItens(item) {
  var returnString;
  if (item.text == "Selecione...")
    returnString = "<span style='font-size: 14px;'><b>Selecione...</b></span>";
  else {
    var selectionText = item.text.split(SEPARADOR);
    returnString =
      "<span style='font-size: 12px;'><b>" +
      tiraEspacos(selectionText[0]) +
      "</b><br/>" +
      tiraEspacos(selectionText[1]) +
      "<br/>" +
      tiraEspacos(selectionText[2]) +
      "<br/>R$ " +
      tiraEspacos(selectionText[3]) +
      "</span>";
  }
  var novoSpan = document.createElement("span");
  novoSpan.innerHTML = returnString;
  return novoSpan;
}

function renderObterExames(data) {
  if (!data) {
    console.log("(app.js) renderObterExames sem conteúdo");
    alert("Erro na conexão com o Servidor #03APP");
    return;
  }
  if (data.hasOwnProperty("erro")) {
    alert(data.erro);
    return;
  } else console.log("(app.js) renderObterExames -> ", data);

  var arrayExames = data;
  var arrayExames = JSON.parse(data);
  if (arrayExames == null || arrayExames.length == 0) {
    alert(
      "Nenhum exame encontrado\ncom os parâmetros informados.\nTente novamente."
    );
    return;
  }

  new Promise((res, rej) => {
    arrayExames.sort(function(a, b) {
      var keyA = a.exame;
      var keyB = b.exame;
      // Compare the 2 dates
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    });

    var retorno = "<option value='-1'>Selecione...</option>";

    arrayExames.forEach((value, index, array) => {
      let codExecutante = value.id_executante;
      let codExame = value.cd_exame;
      var descricao =
        tiraEspacos(value.exame) +
        SEPARADOR +
        tiraEspacos(value.nome_executante) +
        SEPARADOR +
        tiraEspacos(value.endereco) +
        SEPARADOR +
        value.valor;
      retorno +=
        "<option value='" +
        codExecutante +
        SEPARADOR +
        codExame +
        "'>" +
        descricao +
        "</option>";
      if (index === array.length - 1) res(retorno);
    });
  }).then(retorno => {
    const divExame = document.getElementById("divExame");

    divExame.style = "height:66px";

    divExame.innerHTML = "<select id='cbExame'>" + retorno + "</select>";
    $("#cbExame")
      .select2({
        placeholder: "Selecione os exames...",
        allowClear: false,
        templateResult: formatarItens,
        templateSelection: formatarSelecao
      })
      .on("select2:select", function(e) {
        var selectionText = e.params.data.id.split(SEPARADOR);
        codExecutante = selectionText[0];
        codExame = selectionText[1];
      });

    var element = document.querySelector(
      '[aria-labelledby="select2-cbExame-container"]'
    );
    element.style = "height:56px;";

    element = document.getElementById("select2-cbExame-container");
    element.style = "line-height:16px;";
  });
}

//-----------------------------------------------------------------------------------------//

function doSolicitacao() {
  executante = codExecutante;
  solicitante = "XXXX";
  let dadosPaciente = cbPaciente.value.split(SEPARADOR);      
  paciente = dadosPaciente[0];
  cpf = dadosPaciente[1].replace(/\.|-/g,'');
  exame = codExame;
  data = dtExame.value;
  faturar = cbFaturar.value;

  var requisicao =
    "/solicitacao/" +
    executante +
    "/" +
    solicitante +
    "/" +
    paciente +
    "/" +
    cpf +
    "/" +
    exame +
    "/" +
    data +
    "/" +
    dtPeriodo +
    "/" +
    faturar;

  console.log("(app.js) Executando solicitacao");
  return fetch(requisicao)
    .then(response => {
      console.log("(app.js) solicitacao response");
      return response.json();
    })
    .catch(() => {
      console.log("(app.js) solicitacao catch");
      return null;
    });
}

//-----------------------------------------------------------------------------------------//

function renderSolicitacao(resposta) {
  if (!resposta) {
    console.log("(app.js) renderSolicitacao sem conteúdo");
    alert("Erro na solicitação do exame.");
    return;
  } else console.log("(app.js) renderSolicitacao -> ", resposta);
  alert("Exame agendado com sucesso");
  history.go(-1);
}

//-----------------------------------------------------------------------------------------//

function callbackSolicitacao() {
  executante = codExecutante;
  if (executante == null) {
    alert("O exame não foi escolhido.");
    return;
  }
  exame = codExame;
  if (exame == null) {
    alert("O exame não foi escolhido.");
    return;
  }
  solicitante = "XXXX";
  paciente = cbPaciente.value;
  if (paciente == null || paciente == "") {
    alert("O paciente não foi escolhido.");
    return;
  }
  data = dtExame.value;
  if (data == null) {
    alert("A data não foi escolhida.");
    return;
  }
  faturar = cbFaturar.value;
  if (faturar == null) {
    alert("Não foi indicado se o exame será faturado ou não.");
    return;
  }
  senha = funcaoMD5(pwSenha.value);
  if (senha == null) {
    alert("Informe sua senha para confirmação.");
    return;
  }

  document.body.style.cursor = "wait";
  doVerificarSenha(senha).then(retorno => {
    console.log("(app.js) callBackSolicitacao retorno verificarSenha", retorno);
    if (!retorno) {
      document.body.style.cursor = "default";
      console.log("(app.js) renderVerificarSenha sem conteúdo");
      alert("Erro na conexão com o Servidor #03APP");
      return;
    }
    if (retorno.hasOwnProperty("erro")) {
      document.body.style.cursor = "default";
      alert(retorno.erro);
      return;
    }

    doSolicitacao().then(retorno => {
      console.log("(app.js) callBackSolicitacao retorno", retorno);
      renderSolicitacao(retorno);
      document.body.style.cursor = "default";
    });
  });
}

//-----------------------------------------------------------------------------------------//

function callbackCadastrarPaciente() {
  window.location.href = "bdpaciente.html";
}

//-----------------------------------------------------------------------------------------//

function callbackSair() {
  history.go(-1);
}

//-----------------------------------------------------------------------------------------//

$(document).on("keypress", "input", function(e) {
  if (e.which == 13 && e.target == tfExame) {
    callbackConsultarExames();
  }
});

//-----------------------------------------------------------------------------------------//
