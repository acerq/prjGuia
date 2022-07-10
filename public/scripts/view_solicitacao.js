"use strict";

const SEPARADOR = "##";
const funcaoMD5 = new Function("a", "return md5(a)");
const novoDaoConsulta = new Function("", "return new DaoConsulta()");
const novoDaoUsuario = new Function("", "return new DaoUsuario()");

const fnTirarEspera = new Function("tirarEspera()");
const fnColocarEspera = new Function("colocarEspera()");

function tiraEspacos(item) {
  if (item == null) return "";
  var pos = item.length - 1;
  while (item[pos] == " " && pos > 0) pos--;
  return item.substr(0, pos + 1);
}

var _objAtual;

export default class ViewSolicitacao {
  constructor(ctrlSolicitacao) {
    this.ctrl = ctrlSolicitacao;

    _objAtual = this;

    this.daoConsulta = novoDaoConsulta();
    this.tfExame = document.getElementById("tfExame");
    this.cbPaciente = document.getElementById("cbPaciente");
    this.cbExame = document.getElementById("cbExame");
    this.cbFaturar = document.getElementById("cbFaturar");
    this.pwSenha = document.getElementById("pwSenha");
    this.btPacientes = document.getElementById("btPacientes");
    this.btConsultar = document.getElementById("btConsultar");
    this.btEnviar = document.getElementById("btEnviar");
    this.btVoltarOuAgendar = document.getElementById("btVoltarOuAgendar");
    this.usuarioLogado = true;

    this.divResposta = document.getElementById("divResposta");

    if(this.btVoltarOuAgendar != null) {
      this.btVoltarOuAgendar.onclick = this.voltarOuAgendar;
      this.btVoltarOuAgendar.view = this;
    }
    this.btConsultar.onclick = this.obterExames;

    if (this.btPacientes != null) {
      this.btPacientes.onclick = this.ctrl.chamarCadastrarPacientes;
      this.btEnviar.onclick = this.irParaCheckout;
      this.btVoltarOuAgendar.innerHTML = "Voltar";
    } else { 
      this.usuarioLogado = false;
      if(this.btVoltarOuAgendar != null)
        this.btVoltarOuAgendar.innerHTML = "Gerar Voucher";
    }

    //---- Elementos da página de pagamento
    this.tfNomeCartao = null;
    this.tfNumCartao = null;
    this.tfMesValidade = null;
    this.tfAnoValidade = null;
    this.cbBandeira = null;
    this.tfCvv = null;
    this.btOk = null;
    this.btCancelar = null;
    //----

    this.arrayExames = null;
    this.codLocalSelecionado = 0;
    this.codExecutanteSelecionado = null;
    this.codExameSelecionado = null;
    this.valorExameSelecionado = null;
    this.merchantIdExecutor = null;
    this.perccomis = null;
    this.dtPeriodo = null;

    this.nomePaciente = null;
    this.cpfPaciente = null;
    this.ruaPaciente = null;    
    this.numeroPaciente = null;
    this.complementoPaciente = "";
    this.bairroPaciente = null;
    this.cepPaciente = null;
    this.cidadePaciente = null;    
    this.ufPaciente = null;
    
    this.dadosExame = null;
    this.idDadosExame = null;
    this.formaPgto = null;
    
    $(document).on("keypress", "input", function(e) {
      if (e.which == 13 && e.target == _objAtual.tfExame) {
        _objAtual.obterExames();
      }
    });

    if (this.usuarioLogado)
      this.pwSenha.addEventListener("keyup", function(event) {
        if (event.keyCode === 13) {
          _objAtual.irParaCheckout();
        }
      });
  }

  //-----------------------------------------------------------------------------------------//

  async atualizarInterface(ehMedico, arrayPacientes, arrayLocais) {
    //---- Formata a combobox de pacientes ----//
    if (this.usuarioLogado) {

      await this.daoConsulta.abrirDbConsulta();
      let array = await this.daoConsulta.verificarConsultaArmazenada();
      if(array.length != 0) {
        this.daoConsulta.limparConsulta();
        this.tfExame.value = array[0].tfExame;
        this.codExecutanteSelecionado = array[0].codExecutanteSelecionado;
        this.codExameSelecionado = array[0].codExameSelecionado;
        this.atualizarExames(array[0].arrayExames);
        this.codLocalSelecionado = array[0].codLocalSelecionado;
        this.merchantIdExecutor = array[0].merchantIdExecutor;
        this.perccomis = array[0].perccomis;
        this.idDadosExame = array[0].idDadosExame;
      }      
      if (ehMedico) {
        let i;
        let tam = this.cbPaciente.options.length - 1;
        for (i = tam; i > 0; i--) {
          this.cbPaciente.remove(i);
        }
      } else {
        this.cbPaciente.remove(this.cbPaciente.selectedIndex);
        this.btPacientes.hidden = true;
        this.cbPaciente.style =
          "width:100%;-webkit-appearance:none;-moz-appearance:none;text-indent:1px;text-overflow: '';";
      }
      await arrayPacientes.forEach(e => {
        var elem = document.createElement("option");
        elem.value = e.nome + SEPARADOR + e.cpf + SEPARADOR + e.celular + SEPARADOR + e.email + SEPARADOR + 
                     e.rua + SEPARADOR + e.numero + SEPARADOR + e.complemento + SEPARADOR + e.bairro +
                     SEPARADOR + e.cep + SEPARADOR + e.cidade + SEPARADOR + e.uf;
        elem.text = e.nome;
        this.cbPaciente.add(elem);
      });
    }

    //---- Formata a combobox de locais ----//
    let optionsLocais = await new Promise((resolve, reject) => {
      //--- var retorno = "<option value='-1'>Selecione...</option>";
      var retorno = "";
      arrayLocais.forEach((value, index, array) => {
        var codigo = value.codigolocal;
        var descricao = value.nomelocal;
        retorno += "<option value='" + codigo + "'" +           
                    (this.codLocalSelecionado == codigo  ? "selected" : "") +  
                   ">" + descricao + "</option>";
        if (index === array.length - 1) 
          resolve(retorno);
      });
    });

    const divLocal = document.getElementById("divLocal");
    divLocal.innerHTML =
      "<select id='cbLocal'>" + optionsLocais + "</select></div></form>";
    
    $("#cbLocal")
      .select2({
        placeholder: "Selecione o local...",
        allowClear: false,
        templateResult: this.formatarLocal,
        templateSelection: this.formatarLocal
      })
      .on("select2:select", function(e) {
        _objAtual.codLocalSelecionado = e.params.data.id;
      });
  }

  //-----------------------------------------------------------------------------------------//

  formatarLocal(item) {
    var returnString =
      "<span style='font-size: 12px; padding: 0px'>" +
      tiraEspacos(item.text) +
      "</span>";
    var novoSpan = document.createElement("span");
    novoSpan.innerHTML = returnString;
    return novoSpan;
  }

  //-----------------------------------------------------------------------------------------//

  async obterExames() {
    _objAtual.tfExame.value = _objAtual.tfExame.value.toUpperCase();
    var strExame = _objAtual.tfExame.value;
    if(strExame == null || strExame == ""){
      alert("Digite o nome ou parte do nome do exame.");
      return;
    }
    fnColocarEspera();
    await _objAtual.ctrl.obterExames(_objAtual.codLocalSelecionado, strExame);
    fnTirarEspera();
  }

  //-----------------------------------------------------------------------------------------//

  formatarSelecaoExame(item) {
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

  //-----------------------------------------------------------------------------------------//

  formatarItensDeExames(item) {
    var returnString;
    if (item.text == "Selecione...")
      returnString =
        "<span style='font-size: 14px;'><b>Selecione...</b></span>";
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

  //-----------------------------------------------------------------------------------------//

  atualizarExames(arrayExames) {
    if (arrayExames == null || arrayExames.length == 0) {
      alert("Nenhum exame encontrado\ncom os parâmetros informados.\nTente novamente.");
      var divExame = document.getElementById("divExame"); 
      divExame.innerHTML = "";
      divExame.style = "";
      return;
    }
    this.arrayExames = arrayExames;
    new Promise((res, rej) => {
      arrayExames.sort(function(a, b) {
        let keyA = a.exame;
        let keyB = b.exame;
        // Compare the 2 dates
        if (keyA < keyB) return -1;
        if (keyA > keyB) return 1;
        return 0;
      });

      let retorno = "<option value='-1'>Selecione...</option>";
      //let retorno = "";
      arrayExames.forEach((value, index, array) => {
        let codExecutante = value.id_executante;
        let codExame = value.cd_exame;
        let valor = value.valor;
        let merchantIdExecutor = value.marchand_id; //### TODO Trocar
        let perccomis = value.perccomis; 
        let descricao =
          tiraEspacos(value.exame) +
          SEPARADOR +
          tiraEspacos(value.nome_executante) +
          SEPARADOR +
          tiraEspacos(value.endereco) +
          SEPARADOR +
          tiraEspacos(value.valor);
        retorno +=
          "<option value='" +
          codExecutante +
          SEPARADOR +
          codExame +
          SEPARADOR +
          valor +
          SEPARADOR +
          merchantIdExecutor +
          SEPARADOR +
          perccomis +
          "' " +  
          (this.codExecutanteSelecionado == codExecutante && this.codExameSelecionado == codExame ? "selected" : "") +
          ">" +
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
          templateResult: this.formatarItensDeExames,
          templateSelection: this.formatarSelecaoExame
        })
        .on("select2:select", async function(e) {
          var selectionText = e.params.data.id.split(SEPARADOR);
          _objAtual.dadosExame = e.params.data;
          _objAtual.codExecutanteSelecionado = selectionText[0];
          _objAtual.codExameSelecionado = selectionText[1];
          _objAtual.valorExameSelecionado = selectionText[2];
          _objAtual.merchantIdExecutor = selectionText[3];
          _objAtual.perccomis = selectionText[4];
      });

      var element = document.querySelector(
        '[aria-labelledby="select2-cbExame-container"]'
      );
      element.style = "height:56px;";

      element = document.getElementById("select2-cbExame-container");
      element.style = "line-height:16px;";
      fnTirarEspera();
    });
  }

  //-----------------------------------------------------------------------------------------//

  async irParaCheckout() {
    fnColocarEspera();
    if (_objAtual.codExecutanteSelecionado == null) {
      fnTirarEspera();
      alert("O exame não foi escolhido.");
      return;
    }
    if (_objAtual.codExameSelecionado == null) {
      fnTirarEspera();
      alert("O exame não foi escolhido.");
      return;
    }
    let pacienteValue = _objAtual.cbPaciente.value;
    if (pacienteValue == null || pacienteValue == "") {
      fnTirarEspera();
      alert("O paciente não foi escolhido.");
      return;
    }
    
    let faturar = _objAtual.cbFaturar.value;
    if (faturar == null) {
      fnTirarEspera();
      alert("Não foi indicado se o exame será faturado ou não.");
      return;
    }
    // Data Para Boleto
    let formaPgto = _objAtual.cbFaturar.value;
    let tresDiasDepoisDeHoje = new Date();
    tresDiasDepoisDeHoje.setDate(tresDiasDepoisDeHoje.getDate() + 3);
    
    let senha = funcaoMD5(_objAtual.pwSenha.value);
    if (senha == null) {
      fnTirarEspera();
      alert("Informe sua senha para confirmação.");
      return;
    }

    fnColocarEspera();
    if (!(await _objAtual.ctrl.verificarSenha(senha))) {
      fnTirarEspera();
      alert("Senha não confere.");
      return;
    }

    let dadosPaciente = _objAtual.cbPaciente.value.split(SEPARADOR);
    _objAtual.nomePaciente = dadosPaciente[0];
    _objAtual.cpfPaciente = dadosPaciente[1].replace(/\.|-/g, "");
    _objAtual.celularPaciente = dadosPaciente[2];
    _objAtual.emailPaciente = dadosPaciente[3];
    _objAtual.ruaPaciente = dadosPaciente[4];
    _objAtual.numeroPaciente = dadosPaciente[5];
    _objAtual.complementoPaciente = dadosPaciente[6];
    _objAtual.bairroPaciente = dadosPaciente[7];
    _objAtual.cepPaciente = dadosPaciente[8];
    _objAtual.cidadePaciente = dadosPaciente[9];
    _objAtual.ufPaciente = dadosPaciente[10];

    let selecao;
    if(_objAtual.dadosExame != null) 
      selecao = _objAtual.dadosExame.text.split(SEPARADOR);
    else 
      selecao = _objAtual.idDadosExame.split(SEPARADOR); // Foi obtido pela consulta armazenada
    let nomeExame = tiraEspacos(selecao[0]).replace(/\//g, " ");
    let nomeExecutante = tiraEspacos(selecao[1]).replace(/\//g, " ");
    let endereco = tiraEspacos(selecao[2]).replace(/\//g, " ");
    
    fnTirarEspera();
    if (formaPgto == "Crédito" || formaPgto == "Débito") {
      alert("Procedendo checkout por " + formaPgto + " para o pedido de exame");
      _objAtual.colocarFormPgto(formaPgto);
    }
    if (formaPgto == "Boleto") {
      alert("Procedendo checkout do pedido de exame - Geração do Boleto");
      fnColocarEspera();
      _objAtual.ctrl.enviarAgendamentoPgtoBoleto(
        _objAtual.codExecutanteSelecionado,
        _objAtual.cpfPaciente,
        _objAtual.nomePaciente,
        _objAtual.celularPaciente,
        _objAtual.emailPaciente,
        _objAtual.codExameSelecionado,
        tresDiasDepoisDeHoje,
        nomeExame,
        nomeExecutante,
        endereco,
        _objAtual.valorExameSelecionado.replace(/\./g, ""),
        _objAtual.merchantIdExecutor,
        _objAtual.perccomis.replace(/\./g, "")
      );
      fnTirarEspera();
    }
  }

  //-----------------------------------------------------------------------------------------//

  async colocarFormPgto(forma) {
    const CYBERSOURCE_CODE = await _objAtual.ctrl.obterCyberSourceCode();
    let browserFingerPrint = await _objAtual.ctrl.obterFingerPrint();
    
    let endereco = "pgto_credito.html";
    if(forma != "Crédito")
      endereco = "pgto_debito.html"
    $("#divConteudo").load(endereco, function() {
      _objAtual.tfNomeCartao = document.getElementById("tfNomeCartao");
      _objAtual.tfNumCartao = document.getElementById("tfNumCartao");
      _objAtual.tfMesValidade = document.getElementById("tfMesValidade");
      _objAtual.tfAnoValidade = document.getElementById("tfAnoValidade");
      _objAtual.cbBandeira = document.getElementById("cbBandeira");
      _objAtual.tfCvv = document.getElementById("tfCvv");
      _objAtual.btOk = document.getElementById("btOk");
      _objAtual.btCancelar = document.getElementById("btCancelar");

      $("#tfNumCartao").mask("9999 9999 9999 9999");
      $("#tfMesValidade").mask("99");
      $("#tfAnoValidade").mask("9999");

      let selecao;
      if(_objAtual.dadosExame != null) 
        selecao = _objAtual.dadosExame.text.split(SEPARADOR);
      else
        selecao = _objAtual.idDadosExame.split(SEPARADOR); // Foi obtido pela consulta armazenada
      
      let msg =
        "<center><b>Exame Solicitado:</b><br/>" +
        "<span style='font-size: 10px;'><b>" +
        tiraEspacos(selecao[0]) +
        "</b><br/>" +
        tiraEspacos(selecao[1]) +
        "<br/>" +
        tiraEspacos(selecao[2]) +
        "<br/>R$ " +
        tiraEspacos(selecao[3]) +
        "</span></center>";
      
      let bfp = '<p style="background:url(https://h.online-metrix.net/fp/clear.png?org_id=' + CYBERSOURCE_CODE + '&amp;session_id=' + browserFingerPrint + '&amp;m=1)"></p>' +
                '<img src="https://h.online-metrix.net/fp/clear.png?org_id=' + CYBERSOURCE_CODE + '&amp;session_id=' + browserFingerPrint + '&amp;m=2" alt="">' + 
                '<script src="https://h.online-metrix.net/fp/check.js?org_id=' + CYBERSOURCE_CODE + '&amp;session_id=' + browserFingerPrint + '" type="text/javascript"></script>';
    
      $("#divExame").html(msg + bfp);

      _objAtual.btOk.onclick = _objAtual.enviarSolicitacao;
      _objAtual.btCancelar.onclick = _objAtual.voltarOuAgendar;
    });
  }

//-----------------------------------------------------------------------------------------//

exibirConfirmacao(cpfPaciente, nomePaciente, nomeExame, nomeExecutante, endereco, valor, formaPgto, merchantOrderId, url) {
  $("#divConteudo").empty();
  // $("#divConteudo").html("<div id='pdfId'></div><script>PDFObject.embed('" + arq +"#zoom=30', '#pdfId');</script><button onclick='window.history.go(-1)' style='width:100%;'>Fechar</button>");
  $("#divConteudo").load("comprovante.html", function() {

    $("#cpfPaciente").html(cpfPaciente);
    $("#nomePaciente").html(nomePaciente);
    $("#nomeExame").html(nomeExame);
    $("#nomeExecutante").html(nomeExecutante);
    $("#endereco").html(endereco);
    $("#valor").html(valor);
    $("#formaPgto").html(formaPgto);
    $("#merchantOrderId").html(merchantOrderId);
    if(url != null)
      $("#boleto").html("<a href='" + url + "'>Clique aqui para visualizar o boleto</a>");
  });
}

//-----------------------------------------------------------------------------------------//

apresentarPgtoDebito(cpfPaciente, nomePaciente, nomeExame, nomeExecutante, endereco, valor, formaPgto, merchantOrderId, url) {
  $("#divConteudo").empty();
  $("#divConteudo").load("comprovante.html", function() {

    $("#cpfPaciente").html(cpfPaciente);
    $("#nomePaciente").html(nomePaciente);
    $("#nomeExame").html(nomeExame);
    $("#nomeExecutante").html(nomeExecutante);
    $("#endereco").html(endereco);
    $("#valor").html(valor);
    $("#formaPgto").html(formaPgto);
    $("#merchantOrderId").html(merchantOrderId);
    if(url != null)
      $("#boleto").html("<a href='" + url + "'>Clique aqui para visualizar o boleto</a>");
  });
}

//-----------------------------------------------------------------------------------------//

async enviarSolicitacao() {
    fnColocarEspera();

    let numCartao = _objAtual.tfNumCartao.value;
    if (numCartao == null || numCartao == "") {
      fnTirarEspera();
      alert("O número do cartão não foi informado!");
      return;
    }
    numCartao = numCartao.replace(/ /g, "");
    if (numCartao.length < 16) {
      fnTirarEspera();
      alert("O número do cartão não foi informado corretamente!");
      return;
    }

    let nomeCartao = _objAtual.tfNomeCartao.value;
    if (nomeCartao == null || nomeCartao == "") {
      fnTirarEspera();
      alert("O nome no cartão não foi informado!");
      return;
    }

    let bandeira = _objAtual.cbBandeira.value;
    if (bandeira == null || bandeira == "") {
      fnTirarEspera();
      alert("A Bandeira não foi selecionada.");
      return;
    }

    let mesValidade = _objAtual.tfMesValidade.value;
    if (mesValidade == null || mesValidade == "") {
      fnTirarEspera();
      alert("O mês da validade do cartão não foi informado!");
      return;
    }
    let mesInt = parseInt(mesValidade);
    if (mesInt == NaN || mesInt < 1 || mesInt > 12) {
      fnTirarEspera();
      alert("Valor inválido para o mês da validade do cartão!");
      return;
    }

    let anoValidade = _objAtual.tfAnoValidade.value;
    if (anoValidade == null || anoValidade == "") {
      fnTirarEspera();
      alert("O ano da validade do cartão não foi informado!");
      return;
    }
    let agora = new Date();
    anoValidade = parseInt(anoValidade);
    if (anoValidade == NaN || anoValidade < parseInt(agora.getFullYear())) {
      fnTirarEspera();
      alert("Cartão com validade expirada!");
      return;
    }
    if (
      anoValidade ==
      parseInt(
        agora.getFullYear() && mesValidade < parseInt(agora.getMonth()) + 1
      )
    ) {
      fnTirarEspera();
      alert("Cartão com validade expirada!");
      return;
    }

    let cvv = null;
    let forma = _objAtual.cbFaturar.value;
    if(forma == "Crédito") { // Só verificamos o CVV no crédito
      cvv = _objAtual.tfCvv.value;
      if (cvv == null || cvv == "" || cvv.length != 3) {
        fnTirarEspera();
        alert("CVV inválido!");
        return;
      }
    }

    let selecao;
    if(_objAtual.dadosExame != null) 
      selecao = _objAtual.dadosExame.text.split(SEPARADOR);
    else 
      selecao = _objAtual.idDadosExame.split(SEPARADOR); // Foi obtido pela consulta armazenada

    let nomeExame = tiraEspacos(selecao[0]).replace(/\//g, " ");
    let nomeExecutante = tiraEspacos(selecao[1]).replace(/\//g, " ");
    let endereco = tiraEspacos(selecao[2]).replace(/\//g, " ");
    let valor = tiraEspacos(selecao[3]).replace(/\./g, "");

    _objAtual.cpfPaciente = _objAtual.cpfPaciente.replace(/\.|-/g, "");
    _objAtual.valorExameSelecionado = valor;
            
    
    if (forma == "Crédito") {
      await _objAtual.ctrl.enviarAgendamentoPgtoCC(
        _objAtual.codExecutanteSelecionado,
        _objAtual.cpfPaciente,
        _objAtual.nomePaciente,
        _objAtual.celularPaciente,
        _objAtual.emailPaciente,
        _objAtual.ruaPaciente,
        _objAtual.numeroPaciente,        
        _objAtual.complementoPaciente,
        _objAtual.bairroPaciente,
        _objAtual.cepPaciente,
        _objAtual.cidadePaciente,
        _objAtual.ufPaciente,
        _objAtual.codExameSelecionado,
        numCartao,
        nomeCartao,
        bandeira,
        mesValidade,
        anoValidade,
        cvv,
        nomeExame,
        nomeExecutante,
        endereco,
        valor,
        _objAtual.merchantIdExecutor,
        _objAtual.perccomis
      );
    } else if (forma == "Débito") {
      {
          _objAtual.ctrl.enviarAgendamentoPgtoDebito(
          _objAtual.codExecutanteSelecionado,
          _objAtual.cpfPaciente,
          _objAtual.nomePaciente,
          _objAtual.celularPaciente,
          _objAtual.emailPaciente,
          _objAtual.ruaPaciente,
          _objAtual.numeroPaciente,        
          _objAtual.complementoPaciente,
          _objAtual.bairroPaciente,
          _objAtual.cepPaciente,
          _objAtual.cidadePaciente,
          _objAtual.ufPaciente,
          _objAtual.codExameSelecionado,
          numCartao,
          nomeCartao,
          bandeira,
          mesValidade,
          anoValidade,
          nomeExame,
          nomeExecutante,
          endereco,
          valor,
          _objAtual.merchantIdExecutor,
          _objAtual.perccomis
        );
      }
    }
    fnTirarEspera();
  }

  //-----------------------------------------------------------------------------------------//

  async voltarOuAgendar() {
    if(_objAtual.usuarioLogado)
      history.go(-1);
    else {
      if (_objAtual.codExecutanteSelecionado == null) {
        fnTirarEspera();
        alert("O exame não foi escolhido.");
        return;
      }
      if (_objAtual.codExameSelecionado == null) {
        fnTirarEspera();
        alert("O exame não foi escolhido.");
        return;
      }
      await _objAtual.daoConsulta.limparConsulta();
      await _objAtual.daoConsulta.abrirDbConsulta();
      await _objAtual.daoConsulta.salvarConsulta(_objAtual.codLocalSelecionado, _objAtual.arrayExames, _objAtual.tfExame.value, _objAtual.dadosExame.text, _objAtual.codExecutanteSelecionado, _objAtual.codExameSelecionado, _objAtual.merchantIdExecutor, _objAtual.perccomis);
      
      let daoUsuario = novoDaoUsuario();
      await daoUsuario.abrirDb();
      let usrApp = await daoUsuario.obterUsr();
      if(usrApp == null) {
        alert("Para emitir um voucher para este exame, precisamos solicitar seus dados para identificação.");      
        window.location.href = "cadusuario.html";
      } else {
        alert("Faça seu login para emissão do voucher.");      
        window.location.href = "login.html";
      }
    }
  }

  //-----------------------------------------------------------------------------------------//

  colocarEspera() {
    fnColocarEspera();
  }

  //-----------------------------------------------------------------------------------------//

  tirarEspera() {
    fnTirarEspera();
  }

  //-----------------------------------------------------------------------------------------//

}

//-----------------------------------------------------------------------------------------//
