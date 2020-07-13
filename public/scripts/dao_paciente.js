"use strict";

export default class DAOPaciente {
  //-----------------------------------------------------------------------------------------//
  constructor() {
    //
    // Atributos
    //
    this.arrayPacientes = [];
    this.requestDB = null;
    this.db = null;
    this.store = null;
    this.transacao = null;
    this.index = null;
  }

  //-----------------------------------------------------------------------------------------//

  abrirDB(callback) {
    //
    // Inicialização
    //
    this.requestDB = window.indexedDB.open("Paciente", 1);

    this.requestDB.onupgradeneeded = event => {
      console.log("[DAOPaciente.construtor] Criando IndexedDB Paciente");
      this.db = event.target.result;
      this.store = this.db.createObjectStore("Paciente", {
        autoIncrement: true
      });
      this.store.createIndex("cpf", "cpf", { unique: true });
    };

    this.requestDB.onerror = event => {
      console.log("Erro [DAOPaciente.construtor]: " + event.target.errorCode);
      alert("Erro [DAOPaciente.construtor]: " + event.target.errorCode);
      callback();
    };

    this.requestDB.onsuccess = event => {
      console.log("[DAOPaciente.construtor] Sucesso");
      this.db = event.target.result;
      callback();
    };
  }
  //-----------------------------------------------------------------------------------------//

  obterPacientes(callback) {
    document.body.style.cursor = "wait";
    this.arrayPacientes = [];
    try {
      this.transacao = this.db.transaction(["Paciente"], "readonly");
      this.store = this.transacao.objectStore("Paciente");
    } catch (e) {
      console.log("[DAOPaciente.obterPacientes] Erro");
      document.body.style.cursor = "default";
      return null;
    }
    this.store.openCursor().onsuccess = event => {
      document.body.style.cursor = "default";
      var cursor = event.target.result;
      if (cursor) {
        this.arrayPacientes.push(cursor.value);
        cursor.continue();
      } else {
        callback(this.arrayPacientes);
      }
    };
  }

  //-----------------------------------------------------------------------------------------//

  incluir(cpfNovo, nomeNovo, celularNovo, emailNovo, enderecoNovo) {
    if (cpfNovo == null || cpfNovo == "") {
      alert("O CPF deve ser preenchido.");
      return false;
    }
    if (!this.validarCpf(cpfNovo)) {
      alert("O Cpf informado é inválido");
      return false;
    }

    if (nomeNovo == null || nomeNovo == "") {
      alert("O nome deve ser preenchido.");
      return false;
    }

    if (celularNovo == null || celularNovo == "") {
      alert("O celular deve ser preenchido.");
      return false;
    }

    if (emailNovo == null || emailNovo == "") {
      alert("O email deve ser preenchido.");
      return false;
    }

    const padrao = /[a-zA-Z0-9._%-]+@[a-zA-Z0-9-]+.[a-zA-Z]{2,4}/;
    if (!padrao.test(emailNovo)) {
      alert("O email é inválido.");
      return false;
    }

    if (enderecoNovo == null || enderecoNovo == "") {
      alert("O endereço deve ser preenchido.");
      return false;
    }

    this.transacao = this.db.transaction(["Paciente"], "readwrite");
    this.transacao.oncomplete = event => {
      console.log("[DAOPaciente.incluir] Sucesso");
    };
    this.transacao.onerror = event => {
      console.log("[DAOPaciente.incluir] Erro");
    };
    this.store = this.transacao.objectStore("Paciente");
    this.store.add({
      cpf: cpfNovo,
      nome: nomeNovo,
      celular: celularNovo,
      email: emailNovo,
      endereco: enderecoNovo
    });

    // md5('@@MedicoNoApp@@') --> 5759494f25129de6d0bd71f41a582a8c
    let retorno = fetch(
      "/incluirPaciente/" +
        cpfNovo.replace(/\.|-/g, "") +
        "/" +
        nomeNovo +
        "/" +
        "5759494f25129de6d0bd71f41a582a8c" +
        "/" +
        emailNovo +
        "/" +
        celularNovo.replace(/\(|\)|\s|-/g, "") +
        "/" +
        enderecoNovo
    ).then(response => {
        console.log("(app.js) incluirPaciente response");
        return true;
      })
      .catch(() => {
        console.log("(app.js) incluirPaciente catch");
        return false;
      });

    return true;
  }

  //-----------------------------------------------------------------------------------------//

  alterar(cpfAntigo, cpfNovo, nomeNovo, celularNovo, emailNovo, enderecoNovo) {
    if (cpfNovo == null || cpfNovo == "") {
      alert("O CPF deve ser preenchido.");
      return false;
    }
    if (!this.validarCpf(cpfNovo)) {
      alert("O Cpf informado é inválido");
      return false;
    }

    if (nomeNovo == null || nomeNovo == "") {
      alert("O nome deve ser preenchido.");
      return false;
    }

    if (celularNovo == null || celularNovo == "") {
      alert("O celular deve ser preenchido.");
      return false;
    }

    if (emailNovo == null || emailNovo == "") {
      alert("O email deve ser preenchido.");
      return false;
    }

    const padrao = /[a-zA-Z0-9._%-]+@[a-zA-Z0-9-]+.[a-zA-Z]{2,4}/;
    if (!padrao.test(emailNovo)) {
      alert("O email é inválido.");
      return false;
    }

    if (enderecoNovo == null || enderecoNovo == "") {
      alert("O endereço deve ser preenchido.");
      return false;
    }

    this.transacao = this.db.transaction(["Paciente"], "readwrite");
    this.transacao.oncomplete = event => {
      console.log("[DAOPaciente.alterar] Sucesso");
    };
    this.transacao.onerror = event => {
      console.log("[DAOPaciente.excluir] Erro: ", event.target.error);
    };
    this.store = this.transacao.objectStore("Paciente");
    this.store.openCursor().onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.cpf == cpfAntigo) {
          const updateData = cursor.value;
          updateData.cpf = cpfNovo;
          updateData.nome = nomeNovo;
          updateData.celular = celularNovo;
          updateData.email = emailNovo;
          updateData.endereco = enderecoNovo;
          const request = cursor.update(updateData);
          request.onsuccess = () => {
            console.log("[DAOPaciente.alterar] Cursor update - Sucesso ");
          };
        }
        cursor.continue();
      }
    };
    // md5('@@MedicoNoApp@@') --> 5759494f25129de6d0bd71f41a582a8c
    let retorno = fetch(
      "/incluirPaciente/" +
        cpfNovo.replace(/\.|-/g, "") +
        "/" +
        nomeNovo +
        "/" +
        "5759494f25129de6d0bd71f41a582a8c" +
        "/" +
        emailNovo +
        "/" +
        celularNovo.replace(/\(|\)|\s|-/g, "") +
        "/" +
        enderecoNovo
    ).then(response => {
        console.log("(app.js) incluirPaciente response");
        return true;
      })
      .catch(() => {
        console.log("(app.js) incluirPaciente catch");
        return false;
      });

    return true;
  }
  //-----------------------------------------------------------------------------------------//

  excluir(cpfExclusao) {
    this.transacao = this.db.transaction(["Paciente"], "readwrite");
    this.transacao.oncomplete = event => {
      console.log("[DAOPaciente.excluir] Sucesso");
    };
    this.transacao.onerror = event => {
      console.log("[DAOPaciente.excluir] Erro: ", event.target.error);
    };
    this.store = this.transacao.objectStore("Paciente");
    return (this.store.openCursor().onsuccess = event => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.value.cpf == cpfExclusao) {
          const request = cursor.delete();
          request.onsuccess = () => {
            console.log("[DAOPaciente.excluir] Cursor delete - Sucesso ");
            return true;
          };
        }
        cursor.continue();
      }
      return false;
    });
  }

  //-----------------------------------------------------------------------------------------//

  validarCpf(strCpf) {
    let soma;
    let resto;
    let i;

    soma = 0;
    strCpf = strCpf.replace(".", "");
    strCpf = strCpf.replace(".", "");
    strCpf = strCpf.replace("-", "");

    if (strCpf == "00000000000") return false;

    for (i = 1; i <= 9; i++)
      soma = soma + parseInt(strCpf.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;

    if (resto == 10 || resto == 11) resto = 0;
    if (resto != parseInt(strCpf.substring(9, 10))) return false;

    soma = 0;
    for (i = 1; i <= 10; i++)
      soma = soma + parseInt(strCpf.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;

    if (resto == 10 || resto == 11) resto = 0;
    if (resto != parseInt(strCpf.substring(10, 11))) return false;
    return true;
  }

  //-----------------------------------------------------------------------------------------//
}
