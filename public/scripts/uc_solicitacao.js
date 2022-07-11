"use strict";

import ViewSolicitacao from "./view_solicitacao.js";
import DaoPaciente from "./dao_paciente.js";

const download = new Function("blob,nomeArq", "download(blob,nomeArq,'application/pdf')");

const CYBERSOURCE_CODE_DESENV = '1snn5n9w';
const CYBERSOURCE_CODE_PRODUCAO = 'k8vif92e';


export default class CtrlSolicitacao {
  constructor() {
    this.view = new ViewSolicitacao(this);

    this.view.colocarEspera();

    this.daoPaciente = new DaoPaciente();

    this.usrApp = null;
    this.arrayPacientes = [];
    this.arrayLocais = [];
    this.arrayExames = [];
    this.merchantOrderId = null;
    this.ambiente = null;
    this.clientId = null;

    this.init();
  }

  //-----------------------------------------------------------------------------------------//

  async init() {

    await this.obterLocais();
    
    this.usrApp = await window.retornarUsrApp();
    if(this.view.usuarioLogado) {
      await this.daoPaciente.abrirDB();
      await this.obterPacientes();
    } 
    this.view.atualizarInterface(
      this.usrApp.ehMedico,
      this.arrayPacientes,
      this.arrayLocais
    );
    if(this.view.usuarioLogado && this.usrApp.agendamento != null) {
        this.view.tirarEspera();
        await this.completarPgtoDebito();
    }
    this.view.tirarEspera();
  }

  //-----------------------------------------------------------------------------------------//

  async obterPacientes() {
    if (this.usrApp.ehMedico) {
      this.arrayPacientes = await this.daoPaciente.obterPacientes();
      if (this.arrayPacientes.length > 0) {
        this.posAtual = 0;
      } else {
        this.posAtual = -1;
        this.cpfAtual = null;
      }
    } else {
      this.arrayPacientes = [
        {
          cpf: this.usrApp.login,
          nome: this.usrApp.nome,
          celular: this.usrApp.celular,
          email: this.usrApp.email,
          rua : this.usrApp.rua,
          numero : this.usrApp.numero,
          complemento : this.usrApp.complemento,
          bairro : this.usrApp.bairro,
          cep : this.usrApp.cep,
          cidade : this.usrApp.cidade,
          uf : this.usrApp.uf          
        }
      ];
    }
  }

  //-----------------------------------------------------------------------------------------//

  async obterAmbiente() {
    let response = await fetch("/ambiente/", { credentials : "include" });
    this.ambiente = await response.json();
    if (!this.ambiente) {
      this.ambiente = "Desenvolvimento";
    }
  }

  //-----------------------------------------------------------------------------------------//

  async obterClientId() {
    let response = await fetch("/clientid/", { credentials : "include" });
    this.clientId = await response.json();
    if (!this.clientId) {
      this.clientId = null;
    }
  }

  
  //-----------------------------------------------------------------------------------------//

async obterCyberSourceCode() {
    await this.obterAmbiente();
    await this.obterClientId();
    if(this.ambiente == "Desenvolvimento")
      return CYBERSOURCE_CODE_DESENV;
    return  CYBERSOURCE_CODE_PRODUCAO;
  }

  //-----------------------------------------------------------------------------------------//

  async obterLocais() {
    let response = await fetch("/obterLocais/", { credentials : "include" });
    this.arrayLocais = await response.json();
    if (!this.arrayLocais) {
      console.log("obterLocais sem conteúdo");
      alert("Erro na conexão com o Servidor #02APP");
      this.arrayLocais = [];
      return;
    }
    if (this.arrayLocais.hasOwnProperty("erro")) {
      alert(this.arrayLocais.erro);
      this.arrayLocais = [];
      if (this.arrayLocais.erro == "Sessão Expirada")
        window.location.href = "index.html";
      return;
    }
    await this.arrayLocais.sort(function(a, b) {
      var keyA = a.codigolocal;
      var keyB = b.codigolocal;
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    });
  }

  //-----------------------------------------------------------------------------------------//

  async obterExames(local, exame) {
    if (exame == null || exame == "") exame = "*";
    let response = await fetch("/obterExames/" + local + "/" + exame, { credentials : "include" });
    if (!response) {
      console.log("(app.js) obterExames sem conteúdo");
      return;
    }
    let objExames = await response.json();
    if (objExames.hasOwnProperty("erro")) {
      alert(objExames.erro);
      this.arrayExames = [];
      return;
    } else {
      this.arrayExames = JSON.parse(objExames);
      this.view.atualizarExames(this.arrayExames);
    }
  }

  //-----------------------------------------------------------------------------------------//

  async verificarSenha(senha) {
    let requisicao = {
	    'senha' : senha
    };    
    let response = await fetch('/verificarSenha', { 'method': 'POST', 'headers': {'Accept':'application/json','Content-Type':'application/json'}, 
                               'credentials' : 'include', 'body': JSON.stringify(requisicao)} );
    if (!response) {
      return false;
    }
    let msg = await response.json();
    if (msg.hasOwnProperty("erro")) {
      return false;
    }
    return true;
  }

  //-----------------------------------------------------------------------------------------//

  obterFingerPrint() {
    let agora = new Date();
    let timeMillis = agora.getTime().toString();
    this.merchantOrderId = timeMillis;
    return "braspag_split_interclinicas" + timeMillis;
    //### return this.clientId + timeMillis;
  }

  //-----------------------------------------------------------------------------------------//

  async enviarAgendamentoPgtoCC(
    codExecutante,
    cpfPaciente,
    nomePaciente,
    celularPaciente,
    emailPaciente,
    rua,
    numero,
    complemento,
    bairro,
    cep,
    cidade,
    uf,
    codExame,
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
    merchantIdExecutor,
    perccomis
  ) {
    this.view.colocarEspera();
    let proofOfSale = "";
    let paymentId = "";
      
    let obterIp = await fetch('/obterIp');
    let ip = await obterIp.text();
      
    // Processando o pagamento
    let requisicao = {
	    'cpf'          : cpfPaciente,
    	'nome'         : nomePaciente,
      'celular'      : celularPaciente,
      'email'        : emailPaciente,
      'rua'          : rua,      
      'numero'       : numero,
      'complemento'  : complemento,
      'bairro'       : bairro,
      'cep'          : cep,
      'cidade'       : cidade,
      'uf'           : uf,      
      'id'           : this.merchantOrderId,
	    'ip'           : ip,
      'numeroCartao' : numCartao.replace(/ /g, ""),
	    'nomeCartao'   : nomeCartao,
	    'bandeira'     : bandeira,
	    'mesValidade'  : mesValidade,
	    'anoValidade'  : anoValidade,
	    'cvv'          : cvv,
	    'valor'        : valor.replace(/\.|\,/g, ""),
	    'merchantIdExecutor' : merchantIdExecutor,
      'codExame'     : codExame,
      'nomeExame'    : nomeExame,
	    'perccomis'    : perccomis
    };
      
      
    let response = await fetch('/pgtoCC', { 'method': 'POST', 'headers': {'Accept':'application/json','Content-Type':'application/json'}, 
                               'credentials' : 'include', 'body': JSON.stringify(requisicao)} , 10000);
    let resposta = await response.json();
    if (!resposta || !resposta.Payment) {
      console.log("Erro no pagamento");
      this.view.tirarEspera();
      let mensagem = "Pagamento não processado";
      if(resposta.Code)
        mensagem += ": Erro#" + resposta.Code;
      if(resposta.erro)
        mensagem += ": " + resposta.Erro;
      alert(mensagem);
      return;
    }
    if (resposta.Payment.Status == 2 || resposta.Payment.ReturnCode == "00" || resposta.Payment.ReturnCode == 4 || resposta.Payment.ReturnCode == 6) {
      let merchantOrderId = resposta.MerchantOrderId;
      proofOfSale = resposta.Payment.ProofOfSale;
      paymentId = resposta.Payment.PaymentId;
    } else {
      this.view.tirarEspera();
      switch (resposta.Payment.ReturnCode) {
        case 5:
          alert("Pagamento Recusado: Não Autorizado");
          return;
        case 70:
          alert("Pagamento Recusado: Problemas com o Cartão de Crédito");
          return;
        case 77:
          alert("Pagamento Recusado: Cartão Cancelado");
          return;
        case 78:
          alert("Pagamento Recusado: Cartão de Crédito Bloqueado");
          return;
        case 57:
          alert("Pagamento Recusado: Cartão Expirado");
          return;
        case 99:
          alert("Pagamento não realizado: Tempo Expirado");
          return;
        default:
          alert("Pagamento Recusado");
          return;
      }
    }
    //
    // Status: representa o status atual da transação.
    // ReasonCode: representa o status da requisição.
    // ProviderReturnCode: representa o código de resposta da transação da adquirente.
    // Por exemplo, uma requisição de autorização poderá ter o retorno com ReasonCode=0 (Sucessfull),
    // ou seja, a requisição finalizou com sucesso, porém, o Status poderá ser 0-Denied, por ter a
    // transação não autorizada pela adquirente, por exemplo, ProviderReturnCode 57 (um dos códigos de negada da Cielo)
    //
    //

    //###
    if(endereco == null || endereco == undefined || endereco == "")
      endereco = "sem endereço";
    // Agendamento
    requisicao = {
	    'merchantOrderId'     : this.merchantOrderId,
    	'executante'          : codExecutante,
      'solicitante'         : this.usrApp.login,
      'paciente'            : nomePaciente,
	    'cpf'                 : cpfPaciente.replace(/\.|-/g, ""),
      'codExame'            : codExame,
	    'nomeExame'           : nomeExame,
	    'nomeExecutante'      : nomeExecutante,
	    'enderecoExecutante'  : endereco,
	    'faturar'             : "C"
    };
      
    console.log("(app.js) Executando agendamento");
    response = await fetch('/agendamento', { 'method': 'POST', 'headers': {'Accept':'application/json','Content-Type':'application/json'}, 
                               'credentials' : 'include', 'body': JSON.stringify(requisicao)} );
    resposta = await response.json();

    if (!resposta) {
      console.log(" erro no agendamento"); //### O que fazer? 
      this.view.tirarEspera();
      alert("Erro no agendamento do exame.");
      return;
    }
    console.log("(app.js) renderAgendamento -> ", response);
    if (resposta.mensagem == "Ok") {
      this.view.tirarEspera();
      alert("Exame agendado com sucesso!\nAguarde download de confirmação.");
      this.view.colocarEspera();
      cpfPaciente = cpfPaciente.substring(0, 3) + "." + cpfPaciente.substring(3, 6) + "." + cpfPaciente.substring(6, 9) + "-" + cpfPaciente.substring(cpfPaciente.length-2);
      valor = valor.substring(0, valor.length - 2) + "," + valor.substring(valor.length - 2);
      requisicao = {
	      'cpf'             : cpfPaciente,
    	  'nome'            : nomePaciente,
        'numeroCartao'    : numCartao,
        'nomeCartao'      : nomeCartao,
	      'bandeira'        : bandeira,
        'nomeExame'       : nomeExame,
  	    'nomeExecutante'  : nomeExecutante,
	      'endereco'        : endereco,
	      'valor'           : valor,
	      'forma'           : "Cartão de Crédito",
	      'merchantOrderId' : this.merchantOrderId,
	      'proofOfSale'     : proofOfSale,
	      'paymentId'       : paymentId,
	      'url'             : null
      };
      response = await fetch('/gerarConfirmacao', { 'method': 'POST', 'headers': {'Accept':'application/json','Content-Type':'application/json'}, 
                             'credentials' : 'include', 'body': JSON.stringify(requisicao)} );
      let blob = await response.blob();
      
      let nomeArq = this.merchantOrderId + ".pdf";
      await download(blob, nomeArq);
      this.view.tirarEspera();
      alert("Documento de confirmação '" + nomeArq + "'\nsalvo na pasta de downloads");
      
      var file = window.URL.createObjectURL(blob);
      
      this.view.exibirConfirmacao(cpfPaciente, nomePaciente, nomeExame, nomeExecutante, endereco, 
                                  valor, "Cartão de Crédito", this.merchantOrderId, null);      
    } else {
      alert("Erro no agendamento\n" + JSON.stringify(resposta));
    }
  }

  //-----------------------------------------------------------------------------------------//

  async enviarAgendamentoPgtoDebito( 
    codExecutante,
    cpfPaciente,
    nomePaciente,
    celularPaciente,
    emailPaciente,
    codExame,
    numCartao,
    nomeCartao,
    bandeira,
    mesValidade,
    anoValidade,
    nomeExame,
    nomeExecutante,
    endereco,
    valor,
    merchantIdExecutor,
    perccomis
  ) {
    this.view.colocarEspera();
    let proofOfSale = "";
    let paymentId = "";
    let authenticationUrl = "";

    // Processando o pagamento
    let requisicao =
      "/pgtodebito" +
      "/" +
      cpfPaciente +
      "/" +
      nomePaciente +
      "/" +
      celularPaciente +
      "/" +
      emailPaciente +
      "/" +
      this.merchantOrderId +
      "/" + 
      numCartao.replace(/ /g, "") +
      "/" +
      nomeCartao +
      "/" +
      bandeira +
      "/" +
      mesValidade +
      "/" +
      anoValidade +
      "/" +
      valor.replace(/\.|\,/g, "") +
      "/" +
      merchantIdExecutor +
      "/" +
      codExame +
      "/" +
      nomeExame +
      "/" +
      perccomis;
      
    let response = await fetch(requisicao, { credentials : "include" });
    let resposta = await response.json();
    if (!resposta) {
      console.log("Erro no pagamento");
      this.view.tirarEspera();
      alert("Erro - pagamento não processado");
      return;
    }
    this.view.tirarEspera();
    switch (resposta.Payment.ReasonCode) {
      case 0:
      case 9:
        let merchantOrderId = resposta.MerchantOrderId;
        proofOfSale = resposta.Payment.ProofOfSale;
        paymentId = resposta.Payment.PaymentId;
        authenticationUrl = resposta.Payment.AuthenticationUrl;
        break;
      case 7:
        alert("Pagamento Recusado: Não Autorizado");
        return;
      case 12:
        alert("Pagamento Recusado: Problemas com o Cartão de Débito");
        return;
      case 13:
        alert("Pagamento Recusado: Cartão Cancelado");
        return;
      case 14:
        alert("Pagamento Recusado: Cartão de Débito Bloqueado");
        return;
      case 15:
        alert("Pagamento Recusado: Cartão Expirado");
        return;
      case 4:
      case 22:
        alert("Pagamento não realizado: Tempo Expirado");
        return;
      default:
        alert("Pagamento Recusado");
        return;
    }
    // Agendamento
    requisicao =
      "/agendamento" +
      "/" +
      this.merchantOrderId +
      "/" +
      codExecutante +
      "/" +
      this.usrApp.login +
      "/" +
      nomePaciente +
      "/" +
      cpfPaciente.replace(/\.|-/g, "") +
      "/" +
      codExame +
      "/" +
      nomeExame +
      "/" +
      nomeExecutante +
      "/" +
      endereco +
      "/" +
      "D";
    console.log("(app.js) Executando agendamento");
    response = await fetch(requisicao, { credentials : "include" });
    resposta = await response.json();

    if (!resposta) {
      console.log(" erro no agendamento");
      this.view.tirarEspera();
      alert("Erro no agendamento do exame.");
      return;
    }
    console.log("(app.js) renderAgendamento -> ", response);

    alert("Você será redirecionado ao seu banco para completar o pagamento por Cartão de Débito");
    window.location.href = authenticationUrl;
  }

  //-----------------------------------------------------------------------------------------//

  async completarPgtoDebito() {
      
  let response = await fetch("/verificarPgto", { credentials : "include" });
  let ses = await response.json();
    if (!ses) {
      console.log("Erro no pagamento");
      this.view.tirarEspera();
      alert("Erro - pagamento não processado");
      return;
  }
  
  switch (ses.pgto.status) {
    case 0:
      alert("Pagamento não finalizado");
      break;
    case 1:
      alert("Pagamento por boleto autorizado");
      break;
    case 2:
      alert("Pagamento confirmado e finalizado");
      break;
    case 3:
      alert("Pagamento negado por autorizador");
      return;
    case 10:
      alert("Pagamento Cancelado");
      return;
    case 11:
      alert("Pagamento Cancelado/Estornado");
      return;
    case 12:
      alert("Esperando retorno da instituição financeira");
      return;
    case 13:
      alert("Pagamento cancelado por falha no processamento");
      return;
    case 20:
      alert("Pagamento por crédito com recorrência agendada");
      return;
    default:
      alert("indefinido");
      return;
    } 
          
    let cpfPaciente = ses.agendamento.cpf.substring(0, 3) + "." + ses.agendamento.cpf.substring(3, 6) + "." + 
                      ses.agendamento.cpf.substring(6, 9) + "-" + ses.agendamento.cpf.substring(ses.agendamento.cpf.length-2);
    let valor = ses.pgto.valor.substring(0, ses.pgto.valor.length - 2) + "," + ses.pgto.valor.substring(ses.pgto.valor.length - 2);
    alert("Exame agendado com sucesso!\nAguarde download de confirmação.");

    let requisicao =
        "/gerarConfirmacao" +
        "/" +
        cpfPaciente +
        "/" +
        ses.agendamento.nome +
        "/" +
        ses.pgto.numeroCartao +
        "/" +
        ses.pgto.nomeCartao +
        "/" +
        ses.pgto.bandeira +
        "/" +
        ses.agendamento.nomeExame + //TODO
        "/" +
        ses.agendamento.nomeExecutante +
        "/" +
        ses.agendamento.enderecoExecutante +
        "/" +
        valor +
        "/" +
        "Cartão de Débito" +
        "/" +
        ses.pgto.merchantOrderId +
        "/" +
        ses.pgto.proofOfSale +
        "/" +
        ses.pgto.paymentId +
        "/" +
        "null"; // URL 

      response = await fetch(requisicao, { credentials : "include" });
      let blob = await response.blob();
      let nomeArq = ses.pgto.merchantOrderId + ".pdf";
      await download(blob, nomeArq);
      this.view.tirarEspera();
      alert("Documento de confirmação " + nomeArq + " salvo na pasta de downloads");
      // alert("Redirecionando para autenticação");
            
      this.view.exibirConfirmacao(cpfPaciente, ses.agendamento.nome, "nomeExame", "nomeExecutante", "endereco", 
                                  valor, "Cartão de Débito", ses.pgto.merchantOrderId, null);      

      // window.history.go(-1);
  }

  //-----------------------------------------------------------------------------------------//

async enviarAgendamentoPgtoBoleto(
    codExecutante,
    cpfPaciente,
    nomePaciente,
    celularPaciente,
    emailPaciente,
    codExame,
    nomeExame,
    nomeExecutante,
    endereco,
    valor,
    merchantIdExecutor,
    perccomis
  ) {
    this.view.colocarEspera();
    let proofOfSale = "";
    let paymentId = "";
    let url = ""; 
      
    let agora = new Date();
    let timeMillis = agora.getTime().toString();
    // let merchantOrderId =   this.usrApp.login + "-" + timeMillis;
    let merchantOrderId = timeMillis;

    // Processando o pagamento
    let requisicao =
      "/pgtoboleto" +
      "/" +
      cpfPaciente +
      "/" +
      nomePaciente +
      "/" +
      celularPaciente +
      "/" +
      emailPaciente +
      "/" +
      merchantOrderId +
      "/" +
      valor.replace(/\.|\,/g, "") +
      "/" +
      merchantIdExecutor +
      "/" +
      codExame +
      "/" +
      nomeExame +
      "/" +
      perccomis.replace(/\.|\,/g, "") +
      "/" +
      nomeExame;
      
    let response = await fetch(requisicao, { credentials : "include" });
    let resposta = await response.json();
    if (!resposta) {
      console.log("Erro no pagamento");
      this.view.tirarEspera();
      alert("Erro - pagamento não processado");
      return;
    }
    if (resposta.Payment.ReasonCode == 0) {
      merchantOrderId = resposta.MerchantOrderId;
      proofOfSale = resposta.Payment.ProofOfSale;
      paymentId = resposta.Payment.PaymentId;
      url = resposta.Payment.Url;
    } else {
      this.view.tirarEspera();
      switch (resposta.Payment.ReasonCode) {
        case 7:
          alert("Pagamento Recusado: Não Autorizado");
          return;
        case 9:
          alert("Aguardando o processamento do cartão de débito.");
          merchantOrderId = resposta.MerchantOrderId;
          proofOfSale = resposta.Payment.ProofOfSale;
          paymentId = resposta.Payment.PaymentId;
          return;
        case 12:
          alert("Pagamento Recusado: Problemas com o Cartão de Débito");
          return;
        case 13:
          alert("Pagamento Recusado: Cartão Cancelado");
          return;
        case 14:
          alert("Pagamento Recusado: Cartão de Débito Bloqueado");
          return;
        case 15:
          alert("Pagamento Recusado: Cartão Expirado");
          return;
        case 4:
        case 22:
          alert("Pagamento não realizado: Tempo Expirado");
          return;
        default:
          alert("Pagamento Recusado");
          return;
      }
    }
    //
    // Status: representa o status atual da transação.
    // ReasonCode: representa o status da requisição.
    // ProviderReturnCode: representa o código de resposta da transação da adquirente.
    // Por exemplo, uma requisição de autorização poderá ter o retorno com ReasonCode=0 (Sucessfull),
    // ou seja, a requisição finalizou com sucesso, porém, o Status poderá ser 0-Denied, por ter a
    // transação não autorizada pela adquirente, por exemplo, ProviderReturnCode 57 (um dos códigos de negada da Cielo)
    //
    //

    // Agendamento
    requisicao =
      "/agendamento" +
      "/" +
      merchantOrderId +
      "/" +
      codExecutante +
      "/" +
      this.usrApp.login +
      "/" +
      nomePaciente +
      "/" +
      cpfPaciente.replace(/\.|-/g, "") +
      "/" +
      codExame +
      "/" +
      nomeExame +
      "/" +
      nomeExecutante +
      "/" +
      endereco +
      "/" +
      "B";
    console.log("(app.js) Executando agendamento");
    response = await fetch(requisicao, { credentials : "include" });
    resposta = await response.json();

    if (!resposta) {
      console.log(" erro no agendamento");
      this.view.tirarEspera();
      alert("Erro no agendamento do exame.");
      return;
    }
    console.log("(app.js) renderAgendamento -> ", response);
    if (resposta.mensagem == "Ok") {
      this.view.tirarEspera();
      alert("Exame agendado com sucesso!\nAguarde download de confirmação.");
      this.view.colocarEspera();
      //TODO cpfPaciente = cpfPaciente.substring(0, 3) + "." + cpfPaciente.substring(3, 6) + "." + cpfPaciente.substring(6, 9) + "-" + cpfPaciente.substring(cpfPaciente.length-2);
      valor = valor.substring(0, valor.length - 2) + "," + valor.substring(valor.length - 2);

      requisicao =
        "/gerarConfirmacao" +
        "/" +
        cpfPaciente +
        "/" +
        nomePaciente +
        "/" +
        "BOLETO" +
        "/" +
        "BOLETO" +
        "/" +
        "BOLETO" +
        "/" +
        nomeExame +
        "/" +
        nomeExecutante +
        "/" +
        endereco +
        "/" +
        valor +
        "/" +
        "Boleto" +
        "/" +
        merchantOrderId +
        "/" +
        proofOfSale +
        "/" +
        paymentId +
        "/" +
        url.replace(/\//g, "%2F");

      let response = await fetch(requisicao, { credentials : "include" });
      let blob = await response.blob();
      let nomeArq = merchantOrderId + ".pdf";
      await download(blob, nomeArq);
      this.view.tirarEspera();
      alert("Documento de confirmação '" + nomeArq + "'\nsalvo na pasta de downloads");
      
      this.view.exibirConfirmacao(cpfPaciente, nomePaciente, nomeExame, nomeExecutante, 
                                  endereco, valor, "Boleto", merchantOrderId, url);

      //window.history.go(-1);
    } else {
      alert("Erro no agendamento\n" + JSON.stringify(resposta));
    }
  }

//-----------------------------------------------------------------------------------------//

  chamarCadastrarPacientes() {
    window.location.href = "bdpaciente.html";
  }

  //-----------------------------------------------------------------------------------------//

  callbackSair() {
    history.go(-1);
  }

//-----------------------------------------------------------------------------------------//
}

var ucSolicitacao = new CtrlSolicitacao();
