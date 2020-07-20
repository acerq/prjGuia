"use strict";

import DaoPaciente from "./dao_paciente.js";

var view;

export default class ViewSolicitacao {

  constructor() {
    this.daoPaciente = new DaoPaciente();
    this.arrayPacientes = [];

    this.usrApp = null;

    this.hdExecutante = document.getElementById("hdExecutante");
    this.hdSolicitante = document.getElementById("hdSolicitante");
    this.cbPaciente = document.getElementById("cbPaciente");
    this.cbExame = document.getElementById("cbExame");
    this.dtExame = document.getElementById("dtExame");
    this.cbFaturar = document.getElementById("cbFaturar");
    this.btPacientes = document.getElementById("btPacientes");
    this.btEnviar = document.getElementById("btEnviar");
    this.btSair = document.getElementById("btSair");

    //this.btEnviar.onclick = this.enviar;
    this.btSair.onclick = this.sair;
  }

  //-----------------------------------------------------------------------------------------//

  init() {
    view.daoPaciente.abrirDB(view.solicitarObjs);
  }

  //-----------------------------------------------------------------------------------------//

  solicitarObjs() {
    view.arrayPacientes = view.daoPaciente.obterPacientes(view.receberObjs);
  }

  //-----------------------------------------------------------------------------------------//

  receberObjs(array) {
    setTimeout(function() {
      view.usrApp = window.retornarUsrApp();
      if (view.usrApp.ehMedico) {
        view.arrayPacientes = array;
        if (view.arrayPacientes.length > 0) {
          view.posAtual = 0;
        } else {
          view.posAtual = -1;
          view.cpfAtual = null;
        }
      } else {
        view.cbPaciente.remove(view.cbPaciente.selectedIndex);
        view.btPacientes.hidden = true;
        view.cbPaciente.style = "width:100%;-webkit-appearance:none;-moz-appearance:none;text-indent:1px;text-overflow: '';";
        view.arrayPacientes = [
          {
            cpf: view.usrApp.login,
            nome: view.usrApp.nome,
            celular: view.usrApp.celular,
            email: view.usrApp.email
          }
        ];
      }
      view.atualizarInterface();
    }, 1000);
  }

  //-----------------------------------------------------------------------------------------//

  enviar() {
    if (view.operacao == "Incluir") {
      view.daoPaciente.incluir(view.inputCpf.value, view.inputNome.value);
    } else if (view.operacao == "Alterar") {
      view.daoPaciente.alterar(
        view.cpfAtual,
        view.inputCpf.value,
        view.inputNome.value
      );
    } else if (view.operacao == "Excluir") {
      view.daoPaciente.exluir(view.cpfAtual);
    }
    view.solicitarObjs();
  }

  //-----------------------------------------------------------------------------------------//

  atualizarInterface() {
    const SEPARADOR = "##"; // Usado também em app.js

    view.arrayPacientes.forEach(e => {
      var elem = document.createElement("option");
      elem.value = e.nome + SEPARADOR + e.cpf;
      elem.text = e.nome;
      view.cbPaciente.add(elem);
    });
    view.dtExame.value = view.dataParaInput();
  }

  //-----------------------------------------------------------------------------------------//

  dataParaInput() {
    const agora = new Date();
    var d = agora.getDate();
    var m = agora.getMonth() + 1;
    var y = agora.getFullYear();
    if (d < 10) d = "0" + d;
    if (m < 10) m = "0" + m;
    return y + "-" + m + "-" + d;
  }
}

view = new ViewSolicitacao();
view.init();
