"use strict";

import DaoPaciente from "./dao_paciente.js";

var view;

export default class ViewPaciente {
  constructor() {
    this.daoPaciente = new DaoPaciente();

    this.arrayPacientes = [];
    this.operacao = "Navegar";
    this.posAtual = -1;
    this.cpfAtual = null;

    this.btSalvar = document.getElementById("btSalvar");
    this.btCancelar = document.getElementById("btCancelar");

    this.divNavegacao = document.getElementById("divNavegacao");
    this.btPrimeiro = document.getElementById("btPrimeiro");
    this.btAnterior = document.getElementById("btAnterior");
    this.btProximo = document.getElementById("btProximo");
    this.btUltimo = document.getElementById("btUltimo");

    this.btIncluir = document.getElementById("btIncluir");
    this.btAlterar = document.getElementById("btAlterar");
    this.btExcluir = document.getElementById("btExcluir");
    this.btSair = document.getElementById("btSair");

    this.divMensagem = document.getElementById("divMensagem");
    this.inputCpf = document.getElementById("tfCpf");
    this.inputNome = document.getElementById("tfNome");
    this.inputCelular = document.getElementById("tfCelular");
    this.inputEmail = document.getElementById("tfEmail");
    this.inputEndereco = document.getElementById("tfEndereco");

    this.btSalvar.onclick = this.salvar;
    this.btCancelar.onclick = this.cancelar;
    this.btPrimeiro.onclick = this.primeiro;
    this.btAnterior.onclick = this.anterior;
    this.btProximo.onclick = this.proximo;
    this.btUltimo.onclick = this.ultimo;
    this.btIncluir.onclick = this.incluir;
    this.btAlterar.onclick = this.alterar;
    this.btExcluir.onclick = this.excluir;
    this.btSair.onclick = this.sair;

    $(document).ready(function() {
      $("#tfCpf").mask("999.999.999-99");
      $("#tfCelular").mask("(99) 9999-9999?9");
    });
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
    view.arrayPacientes = array;
    if (view.arrayPacientes.length > 0) {
      view.posAtual = 0;
    } else {
      view.posAtual = -1;
      view.cpfAtual = null;
    }
    view.atualizarInterface();
  }

  //-----------------------------------------------------------------------------------------//

  incluir() {
    if (view.operacao == "Navegar") {
      view.inabilitarBotoes();
      view.inputCpf.value = "";
      view.inputNome.value = "";
      view.inputCelular.value = "";
      view.inputEmail.value = "";
      view.inputEndereco.value = "";
      view.divMensagem.innerHTML = "<center>Incluindo...</center><hr/>";
      view.operacao = "Incluir";
    }
  }

  //-----------------------------------------------------------------------------------------//

  alterar() {
    if (view.operacao == "Navegar") {
      view.inabilitarBotoes();
      view.divMensagem.innerHTML = "<center>Alterando...</center><hr/>";
      view.operacao = "Alterar";
    }
  }

  //-----------------------------------------------------------------------------------------//

  excluir() {
    if (view.operacao == "Navegar") {
      view.inabilitarBotoes();
      view.divMensagem.innerHTML = "<center>Confirmar Exclusão?</center><hr/>";
      view.operacao = "Excluir";
      view.btSalvar.textContent = "Excluir";
    }
  }

  //-----------------------------------------------------------------------------------------//

  salvar() {
    let commit = false;
    if (view.operacao == "Incluir") {
      commit = view.daoPaciente.incluir(
        view.inputCpf.value,
        view.inputNome.value,
        view.inputCelular.value,
        view.inputEmail.value,
        view.inputEndereco.value
      );
    } else if (view.operacao == "Alterar") {
      commit = view.daoPaciente.alterar(
        view.cpfAtual,
        view.inputCpf.value,
        view.inputNome.value,
        view.inputCelular.value,
        view.inputEmail.value,
        view.inputEndereco.value
      );
    } else if (view.operacao == "Excluir") {
      commit = view.daoPaciente.excluir(view.cpfAtual);
    }
    if(commit)
      view.solicitarObjs();
  }

  //-----------------------------------------------------------------------------------------//

  primeiro() {
    view.posAtual = 0;
    view.atualizarInterface();
  }

  //-----------------------------------------------------------------------------------------//

  anterior() {
    view.posAtual--;
    view.atualizarInterface();
  }

  //-----------------------------------------------------------------------------------------//

  proximo() {
    view.posAtual++;
    view.atualizarInterface();
  }

  //-----------------------------------------------------------------------------------------//

  ultimo() {
    view.posAtual = view.arrayPacientes.length - 1;
    view.atualizarInterface();
  }

  //-----------------------------------------------------------------------------------------//

  cancelar() {
    view.atualizarInterface();
  }

  //-----------------------------------------------------------------------------------------//

  sair() {
    history.back();
  }

  //-----------------------------------------------------------------------------------------//

  restaurarFuncoes() {
    view.divNavegacao.hidden = false;

    view.btIncluir.disabled = false;
    view.btAlterar.disabled = false;
    view.btExcluir.disabled = false;
    view.inputCpf.disabled = true;
    view.inputNome.disabled = true;
    view.inputCelular.disabled = true;
    view.inputEmail.disabled = true;
    view.inputEndereco.disabled = true;

    view.btAlterar.hidden = false;
    view.btIncluir.hidden = false;
    view.btExcluir.hidden = false;
    view.btPrimeiro.hidden = false;
    view.btAnterior.hidden = false;
    view.btProximo.hidden = false;
    view.btUltimo.hidden = false;

    view.btCancelar.hidden = true;
    view.btSalvar.hidden = true;
    view.operacao = "Navegar";
  }

  //-----------------------------------------------------------------------------------------//

  inabilitarBotoes() {
    view.divNavegacao.hidden = true;

    view.btAlterar.disabled = true;
    view.btIncluir.disabled = true;
    view.btExcluir.disabled = true;
    view.btPrimeiro.disabled = true;
    view.btAnterior.disabled = true;
    view.btProximo.disabled = true;
    view.btUltimo.disabled = true;

    view.btAlterar.hidden = true;
    view.btIncluir.hidden = true;
    view.btExcluir.hidden = true;

    view.btPrimeiro.hidden = true;
    view.btAnterior.hidden = true;
    view.btProximo.hidden = true;
    view.btUltimo.hidden = true;

    view.btCancelar.hidden = false;
    view.btSalvar.hidden = false;
    view.inputCpf.disabled = false;
    view.inputNome.disabled = false;
    view.inputCelular.disabled = false;
    view.inputEmail.disabled = false;
    view.inputEndereco.disabled = false;
  }

  //-----------------------------------------------------------------------------------------//
  atualizarInterface() {
    var mostrarDivNavegacao = false;

    view.restaurarFuncoes();
    if (view.posAtual > 0) {
      view.btPrimeiro.disabled = false;
      view.btAnterior.disabled = false;
      mostrarDivNavegacao = true;
    } else {
      view.btPrimeiro.disabled = true;
      view.btAnterior.disabled = true;
    }
    if (view.posAtual < view.arrayPacientes.length - 1) {
      view.btProximo.disabled = false;
      view.btUltimo.disabled = false;
      mostrarDivNavegacao = true;
    } else {
      view.btProximo.disabled = true;
      view.btUltimo.disabled = true;
    }

    if (view.posAtual > -1) {
      view.cpfAtual = view.arrayPacientes[view.posAtual].cpf;
      view.inputCpf.value = view.arrayPacientes[view.posAtual].cpf;
      view.inputNome.value = view.arrayPacientes[view.posAtual].nome;
      view.inputCelular.value = view.arrayPacientes[view.posAtual].celular;
      view.inputEmail.value = view.arrayPacientes[view.posAtual].email;
      view.inputEndereco.value = view.arrayPacientes[view.posAtual].endereco;
      view.btAlterar.disabled = false;
      view.btExcluir.disabled = false;
    } else {
      view.inputCpf.value = "";
      view.inputNome.value = "";
      view.inputCelular.value = "";
      view.inputEmail.value = "";
      view.inputEndereco.value = "";
      view.btAlterar.disabled = true;
      view.btExcluir.disabled = true;
    }
    view.divMensagem.innerHTML = "<p><center>Cadastro de Pacientes</center></p><hr/>";
    if (!mostrarDivNavegacao) 
    	view.divNavegacao.hidden = true;
    view.btSalvar.textContent = "Salvar";
  }

  //-----------------------------------------------------------------------------------------//
}

view = new ViewPaciente();
view.init();
