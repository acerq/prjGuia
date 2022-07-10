'use strict';

const express = require('express'); 
const fetch = require('node-fetch');
const cors = require('cors'); 
const soap = require('soap');
const redirectToHTTPS = require('express-http-to-https').redirectToHTTPS;
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const pdfDocument = require('pdfkit'); 
const fs = require('fs'); 

//const BASE_URL = 'http://sisp.e-sisp.org:8049/webrunstudio_73/webservices/GSIServices.jws?wsdl';
const BASE_URL = 'https://interclinicasstudio.makerplanet.com/webservices/GSIServices.jws?wsdl';
const SESSION_ID = 'session_id';
const TEMPO_MAXIMO_SESSAO = 20 * 60 * 1000; // 20 minutos
const TEMPO_COOKIE_APOS_SESSAO_FINALIZADA = 20 * 60 * 1000; // 20 minutos
const TEMPO_MAXIMO_REQUISICAO = 60 * 1000; // 60 segundos

const AMBIENTE = "Produção";
                                                    
const CLIENT_ID = (AMBIENTE == "Desenvolvimento" ? 'f0073a5b-a2e8-4cb8-af4f-cb4c95bf003b' : 'DE4E1615-5CD7-43A2-8837-5B45A41DD394');              
const CLIENT_SECRET = (AMBIENTE == "Desenvolvimento" ? '+L9frnKV8EM1AVZYkZCmn+7YJtMOdgU250CIS++9+JU=' : '7dMGNWkbufrvG4yPCiBHJSEbBKYc7C7bnKpVhBKU5VY=');  
const BASE64 = new Buffer(CLIENT_ID + ':' +  CLIENT_SECRET).toString('base64');

const SERVIDOR_OAUTH2 = (AMBIENTE == "Desenvolvimento" ? 'https://authsandbox.braspag.com.br/' : 'https://auth.braspag.com.br/');
const SERVIDOR_CIELO  = (AMBIENTE == "Desenvolvimento" ? 'https://apisandbox.cieloecommerce.cielo.com.br/' : 'https://api.cieloecommerce.cielo.com.br/');
const SERVIDOR_MPI    = (AMBIENTE == "Desenvolvimento" ? 'https://mpisandbox.braspag.com.br' : 'https://mpi.braspag.com.br');

//-----------------------------------------------------------------------------------------//

var usuariosAtivos;
var horaUltimaVerificacao;
var dtPeriodo;
var locais;

//-----------------------------------------------------------------------------------------//

function setPeriodo() {
	soap.createClient(BASE_URL, function(err, client) {
		client.Wsretornaperiodo(null, function(err, result1) {
			if (err) {
				dtPeriodo = null;
				return;
			}
			let resposta = JSON.parse(result1.WsretornaperiodoReturn.$value);

			var dia = resposta.Periodo.substring(0, 2);
			var mes = resposta.Periodo.substring(3, 5);
			var ano = resposta.Periodo.substring(6, 10);
			dtPeriodo = dia + '-' + mes + '-' + ano;
			horaUltimaVerificacao = new Date().getTime();
		});
	});
}

//-----------------------------------------------------------------------------------------//

function setLocais() {
	soap.createClient(BASE_URL, function(err, client) {
		client.Wsretornalocais(null, function(err, result1) {
			if (err) {
				locais = null;
				return;
			}
			let resposta = JSON.parse(result1.WsretornalocaisReturn.$value);
			locais = resposta.locais;
			horaUltimaVerificacao = new Date().getTime();
		});
	});
}

//-----------------------------------------------------------------------------------------//

function acertaData(data) {
	return data.substring(8, 10) + '/' + data.substring(5, 7) + '/' + data.substring(0, 4);
}

//-----------------------------------------------------------------------------------------//

function removerSessoesFinalizadas() {
	let chaves = usuariosAtivos.keys();
	let horaAtual = new Date().getTime();

	while (true) {
		let ch = chaves.next().value;
		if (ch == null) break;
		let sessao = usuariosAtivos.get(ch);
		if (sessao.tempoCorrente + TEMPO_MAXIMO_SESSAO < horaAtual) {
			usuariosAtivos.delete(ch);
		}
	}

	if (horaAtual > horaUltimaVerificacao + TEMPO_MAXIMO_SESSAO) {
		setPeriodo();
		setLocais();
	}
}

//-----------------------------------------------------------------------------------------//

function recuperarSessao(req, resp) {
	new Promise((res, rej) => {
		removerSessoesFinalizadas();
	});

	let session_id = parseInt(req.cookies[SESSION_ID]);
	if (session_id == null || session_id == undefined) {
	  console.log("AQUI");
    resp.json(JSON.parse('{"erro" : "Tempo de Sessão Excedido ou Sessão Não Aberta."}'));
		resp.end();
		return null;
	}

  let sessao = usuariosAtivos.get(session_id);
	if (sessao == null || sessao == undefined) {
		resp.json(JSON.parse('{"erro" : "Sessão não iniciada ou expirada"}'));
		resp.end();
		return null;
	}

	let diferenca = new Date().getTime() - sessao.tempoCorrente;
	if (diferenca > TEMPO_MAXIMO_SESSAO) {
		usuariosAtivos.delete(session_id);
		resp.cookie(SESSION_ID, sessao.session_id, {maxAge: 0, httpOnly: true});
		resp.json(JSON.parse('{"erro" : "Sessão Expirada"}'));
		resp.end();
		return null;
	}
	sessao.tempoCorrente = new Date();
	resp.cookie(SESSION_ID, sessao.session_id, {maxAge: TEMPO_MAXIMO_SESSAO + TEMPO_COOKIE_APOS_SESSAO_FINALIZADA, httpOnly: true});
	return sessao;
}

//-----------------------------------------------------------------------------------------//

function SessaoGuiaRosa(login, senha, nome, ehMedico) {
	this.tempoCorrente = new Date();
	this.session_id = this.tempoCorrente.getTime().valueOf();
	this.login = login;
	this.senha = senha;
	this.nome = nome;
	this.celular = '';
	this.email = '';
	this.rua = '';
	this.numero = '';
	this.complemento = '';
	this.bairro = '';
	this.cep = '';
	this.ehMedico = ehMedico;

	this.pgto = null;
	this.agendamento = null;
}

//-----------------------------------------------------------------------------------------//

SessaoGuiaRosa.prototype.setCadastro = function(celular, email, rua, numero, complemento, bairro, cep, cidade, uf) {
	if (complemento == 'null') complemento = '';

	this.celular = celular;
	this.email = email;
	this.rua = rua;
	this.numero = numero;
	this.complemento = complemento;
	this.bairro = bairro;
	this.cep = cep;
  this.cidade = cidade;
  this.uf = uf
};

//-----------------------------------------------------------------------------------------//

function PgtoCredito(id, nome, cpf, celular, email, numeroCartao, nomeCartao, bandeira, mesValidade, anoValidade, cvv, valor) {
	this.id = id;
	this.nome = nome;
	this.cpf = cpf;
	this.celular = celular;
	this.email = email;
	this.numeroCartao = numeroCartao;
	this.nomeCartao = this.nomeCartao;
	this.bandeira = bandeira;
	this.mesValidade = mesValidade;
	this.anoValidade = anoValidade;
	this.cvv = cvv;
	this.valor = valor;

	this.merchantOrderId = null;
	this.status = null;
	this.proofOfSale = null;
	this.paymentId = null;
}

//-----------------------------------------------------------------------------------------//

PgtoCredito.prototype.setDadosPgto = function(merchantOrderId, status, proofOfSale, paymentId) {
	this.status = status;
	this.merchantOrderId = merchantOrderId;
	this.proofOfSale = proofOfSale;
	this.paymentId = paymentId;
};

//-----------------------------------------------------------------------------------------//

function Agendamento(executante, solicitante, paciente, cpf, codExame, nomeExame, nomeExecutante, enderecoExecutante, faturar) {
	this.executante = executante;
	this.solicitante = solicitante;
	this.paciente = paciente;
	this.cpf = cpf;
	this.codExame = codExame;
	this.nomeExame = nomeExame;
	this.nomeExecutante = nomeExecutante;
	this.enderecoExecutante = enderecoExecutante;
	this.faturar = faturar;
}

//-----------------------------------------------------------------------------------------//

async function doObterAmbiente(req, resp) {
	resp.json(AMBIENTE);
}

//-----------------------------------------------------------------------------------------//

async function doObterClientId(req, resp) {
	resp.json(CLIENT_ID);
}

//-----------------------------------------------------------------------------------------//

function doInicio(req, resp) {
	console.log('+---------- ');
	console.log('| doInicio');
	console.log('+---------- ');

	let sessao = new SessaoGuiaRosa(null, null, null, false);

	resp.json(sessao);
	resp.end();
}

//-----------------------------------------------------------------------------------------//

function doObterUsuarioCorrente(req, resp) {
	console.log('+------------------------- ');
	console.log('| doObterUsuarioCorrente');
	console.log('+------------------------- ');

	let sessao = recuperarSessao(req, resp);
	if (sessao == null) 
    return;    
	resp.json(sessao);
	resp.end();
}

//-----------------------------------------------------------------------------------------//

function doVerificarTimeout(req, resp) {
	let sessao = recuperarSessao(req, resp);
	if (sessao == null) 
    return;    
	resp.json(JSON.parse('{"ok" : "ok"}'));
	resp.end();
}

//-----------------------------------------------------------------------------------------//

function doGuardarUsuarioCorrente(req, resp) {
	let cpf = req.body.cpf;
	let senha = req.body.senha;
	let nome = req.body.nome;
	let celular = req.body.celular;
	let email = req.body.email;
	let rua = req.body.rua;
	let numero = req.body.numero;
	let complemento = req.body.complemento;
	let bairro = req.body.bairro;
	let cep = req.body.cep;
  let cidade = req.body.cidade;
  let uf = req.body.uf;

	let sessao = new SessaoGuiaRosa(cpf, senha, nome, false);
	sessao.setCadastro(celular, email, rua, numero, complemento, bairro, cep, cidade, uf);
	usuariosAtivos.set(sessao.session_id, sessao);
  resp.cookie(SESSION_ID, sessao.session_id, {maxAge: TEMPO_MAXIMO_SESSAO + TEMPO_COOKIE_APOS_SESSAO_FINALIZADA, httpOnly: true});
	resp.json(sessao);
	resp.end();
}

//-----------------------------------------------------------------------------------------//

function doLoginMedico(req, resp) {
	console.log('+------------------------- ');
	console.log('| doLoginMedico ');
	console.log('+------------------------- ');

	// Retirando '.' e '-' do login --> caso onde recebemos cpf.
	let login = req.body.login.replace(/\.|-/g, '');
	let senha = req.body.senha;

	if (typeof login === 'undefined' || login === null) {
		resp.json(JSON.parse('{"erro" : "[Erro:#0001] Usuário Inválido"}'));
		return;
	}

	if (typeof senha === 'undefined' || senha === null) {
		resp.json(JSON.parse('{"erro" : "[Erro:#0002] Senha Inválida"}'));
		return;
	}

	// Montando a string JSON para a requisição
	let strJson = '{"login": "' + login + '", "senha": "' + senha + '"}';

	// Recupera o objeto soap da biblioteca node.js
	// Cria um cliente para o WebService
	soap.createClient(BASE_URL, {wsdl_options: {timeout: TEMPO_MAXIMO_REQUISICAO}}, function(err, client) {
		if (client == null || typeof client === 'undefined') {
			if (err.hasOwnProperty('code') && err.code == 'ETIMEDOUT') {
				resp.json(JSON.parse('{"erro" : "[Erro:#0003] Falha na Conexão com o Servidor: TIMEOUT"}'));
			} else {
				resp.json(JSON.parse('{"erro" : "[Erro:#0003] Falha na Conexão com o Servidor"}'));
			}
			resp.end();

			return;
		}

		// Faz a solicitação ao WebService 'Wslogin'
		client.Wslogin({TXTjson: strJson}, function(err, wsResposta) {
			if (err) {
				resp.json(JSON.parse('{"erro" : "[Erro:#0004] Falha na Conexão com o Servidor"}'));
				return;
			}
			let resposta = JSON.parse(wsResposta.WsloginReturn.$value);
			if (resposta.status == 'error') {
				doLoginPaciente(req, resp);
				return;
			}
			let sessao = new SessaoGuiaRosa(login, senha, resposta.nome, true);

			usuariosAtivos.set(sessao.session_id, sessao);
			resp.cookie(SESSION_ID, sessao.session_id, {maxAge: TEMPO_MAXIMO_SESSAO + TEMPO_COOKIE_APOS_SESSAO_FINALIZADA, httpOnly: true});
			resp.json(sessao);
		});
	});
}

//-----------------------------------------------------------------------------------------//

function doLoginPaciente(req, resp) {
	console.log('+------------------------- ');
	console.log('| doLoginPaciente ');
	console.log('+------------------------- ');

	let login = req.body.login.replace(/\.|-/g, '');
	let senha = req.body.senha;
	let strJson = '{"cpf": "' + login + '", "senha": "' + senha + '"}';

	soap.createClient(BASE_URL, function(err, client) {
		client.Wsvalidapaciente({TXTjson: strJson}, function(err, wsResposta) {
			if (err) {
				resp.json(JSON.parse('{"erro" : "[Erro:#0005] Falha na Conexão com o Servidor"}'));
				return;
			}
			let resposta = JSON.parse(wsResposta.WsvalidapacienteReturn.$value); //### VER
			if (resposta.status == 'error') {
				resp.json(JSON.parse('{"erro" : "[Erro:#0006] Login Inválido"}'));
				return;
			}
			let sessao = new SessaoGuiaRosa(login, senha, resposta.nome, false);
			usuariosAtivos.set(sessao.session_id, sessao);
			resp.cookie(SESSION_ID, sessao.session_id, {maxAge: TEMPO_MAXIMO_SESSAO + TEMPO_COOKIE_APOS_SESSAO_FINALIZADA, httpOnly: true});
			resp.json(sessao);
		});
	});
}

//-----------------------------------------------------------------------------------------//

function doObterLocais(req, resp) {
	resp.json(locais);
}

//-----------------------------------------------------------------------------------------//

function doObterPeriodo(req, resp) {
	resp.json(dtPeriodo);
}

//-----------------------------------------------------------------------------------------//

function doIncluirUsuarioPaciente(req, resp) {
	console.log('+------------------------- ');
	console.log('| doIncluirUsuarioPaciente ');
	console.log('+------------------------- ');

	let cpf = req.body.cpf.replace(/\.|-/g, '');
	let nome = req.body.nome;
	let senhaMD5 = req.body.senhaMD5;
	let celular = req.body.celular;
	let email = req.body.email;
	let rua = req.body.rua;
	let numero = req.body.numero;
	let complemento = req.body.complemento;
	if (complemento == 'null') complemento = '';
	let bairro = req.body.bairro;
	let cep = req.body.cep;
  let cidade = req.body.cidade;
  let uf = req.body.uf;
	let endereco = rua + ' ' + numero + ' ' + complemento + '-' + bairro + ',' + cep + "-" + cidade + "-" + uf;

	let strJson = '{"nome": "' + nome + '","cpf":"' + cpf + '","senha":"' + senhaMD5 + '","celular":"' + celular + '","email":"' + email  + '","endereco":"' + endereco + '"}';

	soap.createClient(BASE_URL, function(err, client) {
		client.Wsincluipaciente({TXTjson: strJson}, function(err, result1) {
			if (err) {
				let erro = err.response.body;
				let posInicial = erro.indexOf('<faultstring>') + '<faultstring>'.length;
				let posFinal = erro.indexOf('</faultstring>');
				let msg = erro.substring(posInicial, posFinal);
				resp.json(JSON.parse('{"erro" : "[Erro:#0007] Erro na conexão com o servidor - ' + msg + '"}'));
				return;
			}
			let resposta = JSON.parse(result1.WsincluipacienteReturn.$value);
			let sessao = new SessaoGuiaRosa(cpf, senhaMD5, nome, false);
			sessao.setCadastro(celular, email, rua, numero, complemento, bairro, cep, cidade, uf);

			usuariosAtivos.set(sessao.session_id, sessao);
			resp.cookie(SESSION_ID, sessao.session_id, {maxAge: TEMPO_MAXIMO_SESSAO + TEMPO_COOKIE_APOS_SESSAO_FINALIZADA, httpOnly: true});
			resp.json(sessao);
			resp.end();
		});
	});
}

//-----------------------------------------------------------------------------------------//

function doIncluirPaciente(req, resp) {
	console.log('+------------------------- ');
	console.log('| doIncluirPaciente ');
	console.log('+------------------------- ');

	let sessao = recuperarSessao(req, resp);
	if (sessao == null) 
    return;

	let cpf = req.body.cpf.replace(/\.|-/g, '');
	let nome = req.body.nome;
	let senhaMD5 = req.body.senhaMD5;
	let celular = req.body.celular;
	let email = req.body.email;
	let rua = req.body.rua;
	let numero = req.body.numero;
	let complemento = req.body.complemento;
	if (complemento == 'null') complemento = '';
	let bairro = req.body.bairro;
	let cep = req.body.cep;
	let endereco = rua + ' ' + numero + ' ' + complemento + '-' + bairro + ',' + cep;

	let strJson = '{"nome": "' + nome + '","cpf":"' + cpf + '","senha":"' + senhaMD5 + '","celular":"' + celular + '","email":"' + email + '","endereco":"' + endereco + '"}';

	soap.createClient(BASE_URL, function(err, client) {
		client.Wsincluipaciente({TXTjson: strJson}, function(err, result1) {
			if (err) {
				let erro = err.response.body;
				let posInicial = erro.indexOf('<faultstring>') + '<faultstring>'.length;
				let posFinal = erro.indexOf('</faultstring>');
				let msg = erro.substring(posInicial, posFinal);
				resp.json(JSON.parse('{"erro" : "[Erro:#0007] Erro na conexão com o servidor - ' + msg + '"}'));
				return;
			}
			let resposta = JSON.parse(result1.WsincluipacienteReturn.$value);
			resp.json(resposta);
			resp.end();
		});
	});
}

//-----------------------------------------------------------------------------------------//

function doObterExames(req, resp) {
	console.log('+------------------------- ');
	console.log('| doObterExames ');
	console.log('+------------------------- ');


	let local = req.params.local;
	let exame = req.params.exame;

	let strJson = '{"local": "' + local + '","string_exame":"' + exame + '"}';

	soap.createClient(BASE_URL, function(err, client) {
		client.Wsretornaexames({TXTjson: strJson}, function(err, result1) {
			if (err) {
				resp.json(JSON.parse('{"erro" : null}'));
				return;
			}
			let resposta = JSON.parse(result1.WsretornaexamesReturn.$value);
			let arrayExames = resposta.exames;
			resp.json(JSON.stringify(arrayExames));
		});
	});
}

//-----------------------------------------------------------------------------------------//

function doAgendamento(req, resp) {
	let sessao = recuperarSessao(req, resp);
	if (sessao == null) 
    return;

	let executante = req.body.executante;
	let merchantOrderId = req.body.merchantOrderId;
	let solicitante = req.body.solicitante;
	let paciente = req.body.paciente;
	let cpf = req.body.cpf;
	let codExame = req.body.codExame;
	let nomeExame = req.body.nomeExame;
	let nomeExecutante = req.body.nomeExecutante;
	let enderecoExecutante = req.body.enderecoExecutante;
	let faturar = req.body.faturar;

	if (sessao.ehMedico) {
		solicitante = sessao.login;
	} else {
		solicitante = '0200'; //### TODO
	}
	console.log('executando doAgendamento');
	if (
		typeof merchantOrderId === 'undefined' ||
		typeof executante === 'undefined' ||
		typeof solicitante === 'undefined' ||
		typeof paciente === 'undefined' ||
		typeof codExame === 'undefined' ||
		typeof nomeExame === 'undefined' ||
		typeof nomeExecutante === 'undefined' ||
		typeof enderecoExecutante === 'undefined' ||
		typeof faturar === 'undefined'
	) {
		resp.json(JSON.parse('{"erro" : "[Erro:#0008] Solicitação Inválida"}'));
		return;
	}
  
  let data = new Date();
  let dia = String(data.getDate()). padStart(2,'0');
  let mes = String(data.getMonth() + 1). padStart(2, '0');
  let ano = data.getFullYear();
  let dataParaEnvio = ano + '/' + mes + '/' + dia;

	let agendamento = new Agendamento(executante, solicitante, paciente, cpf, codExame, nomeExame, nomeExecutante, enderecoExecutante, faturar);
	sessao.agendamento = agendamento;

	let dados =
		'{"CD_EXECUTANTE":"' +
		executante +
		'",' +
		'"CD_SOLICITANTE":"' +
		solicitante +
		'",' +
		'"NM_PACIENTE":"' +
		paciente +
		'",' +
		'"CD_EXAME":"' +
		codExame +
		'",' +
		'"DT_EXAME":"' +
		dataParaEnvio + //### codExame +
		'",' +
		'"DT_PERIODO":"' +
		dtPeriodo.replace(/-/g, '/') +
		'",' +
		'"CPF":"' +
		cpf +
		'",' +
		'"FAT_SN":"' +
		faturar +
		'",' +      
		'"CD_ORDER":"' +
		merchantOrderId +
		'"}';

	console.log(dados);

	soap.createClient(BASE_URL, function(err, client) {
		client.Importacaoguiarosaimportarincluirregistromob3ws({Dados: dados}, function(err, result) {
			if (err) {
				resp.json(JSON.parse('{"erro" : "[Erro:#0009] Solicitação Inválida"}'));
				return;
			}
			let resposta = result.Importacaoguiarosaimportarincluirregistromob3wsReturn.$value;
			resp.json(JSON.parse('{"mensagem":"Ok"}'));
		});
	});
}

//-----------------------------------------------------------------------------------------//

async function doPgtoCC(req, resp) {
	let sessao = recuperarSessao(req, resp);
	if (sessao == null) 
    return;    
    
	let nome = req.body.nome;
	let cpf = req.body.cpf;
  let celular = req.body.celular;
	let email = req.body.email;
  
  let rua = req.body.rua;
  let numero = req.body.numero;
  let complemento = req.body.complemento;
  let bairro = req.body.bairro;
  let cep = req.body.cep;
  let cidade = req.body.cidade;
  let uf = req.body.uf;  
  
	let id = req.body.id;
	let ip = req.body.ip;
	let numeroCartao = req.body.numeroCartao;
	let nomeCartao = req.body.nomeCartao;
	let bandeira = req.body.bandeira;
	let mesValidade = req.body.mesValidade;
	let anoValidade = req.body.anoValidade;
	let cvv = req.body.cvv;
	let valor = req.body.valor;
	let merchantIdExecutor = req.body.merchantIdExecutor;
  let codExame = req.body.codExame;
  let nomeExame = req.body.nomeExame;  
	let perccomis = req.body.perccomis;

	if(typeof nome === 'undefined' ||
		 typeof cpf === 'undefined' ||
		 typeof celular === 'undefined' ||
		 typeof email === 'undefined' ||
		 typeof id === 'undefined' ||
		 typeof numeroCartao === 'undefined' ||
		 typeof nomeCartao === 'undefined' ||
		 typeof bandeira === 'undefined' ||
		 typeof mesValidade === 'undefined' ||
		 typeof anoValidade === 'undefined' ||
		 typeof cvv === 'undefined' ||
		 typeof valor === 'undefined' ||
		 typeof merchantIdExecutor === 'undefined' ||
		 typeof codExame === 'undefined' ||
		 typeof nomeExame === 'undefined' ||
		 typeof perccomis === 'undefined') {
		resp.json(JSON.parse('{"erro" : "[Erro:#0012] Solicitação Inválida"}'));
		return;
	}

  let browserFingerPrint = id;
  
	let pgtoCC = new PgtoCredito(id, nome, cpf, celular, email, numeroCartao, nomeCartao, bandeira, mesValidade, anoValidade, cvv, valor);

	let myHeaders = {
		'Content-Type': 'application/x-www-form-urlencoded',
		'Authorization': 'Basic ' + BASE64
	};

	let requisicao = {
		method: 'POST',
		headers: myHeaders,
		body: 'grant_type=client_credentials'
	};

                                    
  console.log("PONTO 0: " + CLIENT_ID + " - " + CLIENT_SECRET);
  console.log("PONTO 1: " + SERVIDOR_OAUTH2);
  console.log("PONTO 2: " + JSON.stringify(requisicao));

  let responseBraspag;
  let respostaOAUTH2;
  try {
	  responseBraspag = await fetch(SERVIDOR_OAUTH2 + '/oauth2/token', requisicao);
	  respostaOAUTH2 = await responseBraspag.json();
  }
  catch(e) {
    resp.json(JSON.parse('{"erro" : "[Erro:#1001] Falha na Tentativa de Pagamento. Por favor, tente mais tarde. "}'));
    console.log("1001: " + e);
    return;
  }

  if(respostaOAUTH2.error != undefined) {
    resp.json(JSON.parse('{"erro" : "[Erro:#1030] Falha na Tentativa de Pagamento. Por favor, tente mais tarde. "}'));
    console.log("Erro no OAUTH2: " + respostaOAUTH2.error + " - " + respostaOAUTH2.description);
    return;
    
  }
  
  await console.log("PONTO 3: " + JSON.stringify(respostaOAUTH2));  
	let access_token = await respostaOAUTH2.access_token;
  await console.log("PONTO 4: " + await access_token);

	let percSubordinado = 100.00 - perccomis;
	
  console.log(await "---->");
  console.log(await "----> valor = " + valor);
  console.log(await "----> percSubordinado = " + perccomis + " " + percSubordinado);
  console.log(await "----> ip = " + ip);
  console.log(await "----> merchantIdExecutor = " + merchantIdExecutor);
  console.log(await "----> deveria ser  = " + "0ecde1ed-51b7-405c-b7ed-7f44af1fefa3");
  console.log(await "---->");

  //### RETIRAR
  if(AMBIENTE == "Desenvolvimento")
    merchantIdExecutor = await "0ecde1ed-51b7-405c-b7ed-7f44af1fefa3";
  
	const myBody = {
		'MerchantOrderId': id, 
		'Customer': {
			'Name' : nome,
			'Identity' : cpf,
			'IdentityType' : 'CPF',
      'Phone' : '55' + celular,
			'Email' : email,
      'BillingAddress' : {
        'Street' : rua,
        'Number' : numero,
        'Complement' : complemento,
        'District' : bairro,
        'ZipCode' : cep,
        'State' : uf,
        'City' : cidade,
        'Country' : 'BR'
      }
		},
		'Payment' : {
			'Type' : 'SplittedCreditCard',
			'Amount' : valor,
			'Capture' : 'true',
      'Installments' : '1',
      'SoftDescriptor' : 'GuiaRosa',
			'CreditCard' : {
				'CardNumber' : numeroCartao,
				'Holder' : nomeCartao,
				'ExpirationDate' : mesValidade + '/' + anoValidade,
				'SecurityCode' : cvv,
				'Brand' : bandeira,
        'SaveCard' : 'false'
			},
      'FraudAnalysis' : {
				'Provider' : 'Cybersource',
				'TotalOrderAmount' : valor,
        'Cart' : {
            'isgift': 'false',
            'items': [
                    {
                        'name': nomeExame,
                        'quantity': 1,
                        'sku': codExame,
                        'unitprice': valor
                    }
                ]
        },
        'Shipping' : {
          'ShippingMethod' : 'None',
        },
        browser: {
          'IpAddress' : ip,
          'BrowserFingerPrint' : await browserFingerPrint
        },
        'MerchantDefinedFields' : [  
                {  
                    'Id' : 1,
                    'Value' : cpf
                },
                {  
                    'Id' : 4,
                    'Value' : 'Movel'
                },
                {  
                    'Id' : 9,
                    'Value' : 'SIM'
                },
                {  
                    'Id' : 33,
                    'Value' : 'Digitado'
                },
                {  
                    'Id' : 41,
                    'Value' : 'CPF'
                },
                {  
                    'Id' : 52,
                    'Value' :'Saúde e Beleza'
                },
                {  
                    'Id' : 83,
                    'Value' :'Saúde'
                },
                {  
                    'Id' :84,
                    'Value' : 'PROPRIA'
                }
            ]
			},
			'Currency' : 'BRL',
			'Country' : 'BRA',
			'SplitPayments' : [
				{                         
					'SubordinateMerchantId' : merchantIdExecutor,
					'Amount' : valor, 
					'Fares' : {
						'Mdr' : perccomis,
						'Fee' : 0
					}
				}
			]
		}
	};

	myHeaders = {
		'Authorization': 'Bearer ' + await access_token,
		'Content-Type': 'application/json'
	};

  let corpo = JSON.stringify(await myBody);
	corpo = corpo.replace(/\\\"/g,"'");
  console.log("PONTO 5: " + await JSON.stringify(corpo));
  
  
	requisicao = {
		'method': 'POST',
		'headers': myHeaders,
	  'body': corpo
	};
  
  let respostaPgto;  
  try {
    console.log("PONTO 6: " + await JSON.stringify(requisicao));
  	responseBraspag = await fetch(SERVIDOR_CIELO + '1/sales/', requisicao);
    console.log("PONTO 7: " + await JSON.stringify(responseBraspag));
	  respostaPgto = await responseBraspag.json();
  }
  catch(e) {
    console.log("1002: " + e);
    resp.json(JSON.parse('{"erro" : "[Erro:#1002] Falha na Tentativa de Pagamento. Por favor, tente mais tarde. "}'));
    return;
  }
	console.log('doPgtoCC Resposta\n' + JSON.stringify(await respostaPgto));
	
  if(respostaPgto != null && respostaPgto.Payment != null && respostaPgto.Payment.Links != null) {
    console.log(await 'doPgtoCC LINKS -----------\n');
	  console.log(await respostaPgto.Payment.Links);
  }
  if(respostaPgto != null && respostaPgto.Payment != null && respostaPgto.Payment.SplitErrors != null) {
    console.log(await 'doPgtoCC SPLIT ERRORS -----------\n');
  	console.log(await respostaPgto.Payment.SplitErrors);
  }

	sessao.pgto = await pgtoCC;
	if (await respostaPgto.Payment) 
		pgtoCC.setDadosPgto(respostaPgto.MerchantOrderId, respostaPgto.Payment.Status, respostaPgto.Payment.ProofOfSale, respostaPgto.Payment.PaymentId);

	resp.json(await respostaPgto);
}

//-----------------------------------------------------------------------------------------//

async function doPgtoDebito(req, resp) {
	let sessao = recuperarSessao(req, resp);
	if(sessao == null)
	  return;

	let nome = req.body.nome;
	let cpf = req.body.cpf;
	let celular = req.body.celular;
	let email = req.body.email;
	let id = req.body.id;
	let ip = req.body.ip;
	let numeroCartao = req.body.numeroCartao;
	let nomeCartao = req.body.nomeCartao;
	let bandeira = req.body.bandeira;
	let mesValidade = req.body.mesValidade;
	let anoValidade = req.body.anoValidade;
	let cvv = req.body.cvv;
	let valor = req.body.valor;
	let merchantIdExecutor = req.body.merchantIdExecutor;
	let perccomis = req.body.perccomis;

	console.log('executando doPgtoDebito' + nome);
	if (
		typeof nome === 'undefined' ||
		typeof cpf === 'undefined' ||
		typeof celular === 'undefined' ||
		typeof email === 'undefined' ||
		typeof id === 'undefined' ||
		typeof numeroCartao === 'undefined' ||
		typeof nomeCartao === 'undefined' ||
		typeof bandeira === 'undefined' ||
		typeof mesValidade === 'undefined' ||
		typeof anoValidade === 'undefined' ||
		typeof cvv === 'undefined' ||
		typeof valor === 'undefined' ||
		typeof merchantIdExecutor === 'undefined' ||
		typeof perccomis === 'undefined'
	) {
		console.log('undefined 0012');
		resp.json(JSON.parse('{"erro" : "[Erro:#0012] Solicitação Inválida"}'));
		return;
	}
  ip = ip.replace("\"",'');

  //### let browserFingerPrint = CLIENT_ID + id;
  let browserFingerPrint = id;
  
	console.log('parâmetros ok doPgtoDebito');
  
  //### trocar depois para PgtoDébito
	let pgtoDebito = new PgtoCredito(id, nome, cpf, celular, email, numeroCartao, nomeCartao, bandeira, mesValidade, anoValidade, cvv, valor);

	let myHeaders = {
		'Content-Type': 'application/json',
		'Authorization': 'Basic ' + BASE64
	};

	let requisicao = {
		method: 'POST',
		headers: myHeaders,
		body: {
         "EstablishmentCode":"1006993069",
         "MerchantName": "Sistema Interclínicas",
         "MCC": "5912"
      }
	};

	console.log('doPgtoDebito --> ' + JSON.stringify(requisicao));
	let responseBraspag = await fetch(SERVIDOR_MPI + '/v2/auth/token', requisicao);

  console.log('fetch 3DS20 Passo 1');
	let resposta3DS20 = await responseBraspag.json();
	console.log('json 3DS20');
	console.log(resposta3DS20);

	let access_token = resposta3DS20.access_token;
	let percSubordinado = 100.00 - perccomis;
	
  console.log("---->");
  console.log("----> valor = " + valor);
  console.log("----> percSubordinado = " + perccomis + " " + percSubordinado);
  console.log("----> ip = " + ip);
  console.log("----> merchantIdExecutor = " + merchantIdExecutor);
  console.log("----> deveria ser  = " + "0ecde1ed-51b7-405c-b7ed-7f44af1fefa3");
  console.log("---->");

  //### RETIRAR
  merchantIdExecutor = "0ecde1ed-51b7-405c-b7ed-7f44af1fefa3";
  
	const myBody = {
		MerchantOrderId: id, 
		Customer: {
			Name: nome,
			Identity: cpf,
			IdentityType: 'CPF',
			Phone : '55' + celular,
			Email: email
		},
		Payment: {
			Type: 'SplittedCreditCard',
			Amount: valor,
			Capture: true,
      Installments: 1,
      SoftDescriptor: 'GuiaRosa',
			CreditCard: {
				CardNumber: numeroCartao,
				Holder: nomeCartao,
				ExpirationDate: mesValidade + '/' + anoValidade,
				SecurityCode: cvv,
				Brand: bandeira,
        SaveCard: 'false'
			},
			Currency: 'BRL',
			Country: 'BRA',
			ReturnUrl: 'https://guia-rosa.glitch.me/finalizarDebito',
	    DebitCard: {
				CardNumber: numeroCartao,
				Holder: nomeCartao,
				ExpirationDate: mesValidade + '/' + anoValidade,
			  SecurityCode: cvv,
				Brand: bandeira,
        SaveCard: false
			},
      ExternalAuthentication:{
            "Cavv":"AAABB2gHA1B5EFNjWQcDAAAAAAB=",
            "Xid":"Uk5ZanBHcWw2RjRCbEN5dGtiMTB=",
            "Eci":"5",
            "Version":"2",
            "ReferenceID":"a24a5d87-b1a1-4aef-a37b-2f30b91274e6"
      },

      SplitPayments: [
				{                         
					"SubordinateMerchantId": merchantIdExecutor,
					"Amount": valor, 
					"Fares": {
						"Mdr": perccomis,
						"Fee": 0
					}
				}
			],
		}
	};

	myHeaders = {
		Authorization: 'Bearer ' + await access_token,
		'Content-Type': 'application/json'
	};

  let corpo = JSON.stringify(myBody);
	console.log('doPgtoDébito 1 --> ' + corpo);
  
	requisicao = {
		'method': 'POST',
		'headers': myHeaders,
	  'body': corpo
	};

	console.log('doPgtoDébito 2 --> ' + JSON.stringify(requisicao));
	responseBraspag = await fetch(SERVIDOR_CIELO + '/1/sales/', JSON.stringify(requisicao));
  
	console.log('fetch doPgtoDébito ');

	let respostaPgto = await responseBraspag.json();

	console.log(await 'json doPgtoDébito');
	console.log(await respostaPgto);
	console.log(await 'doPgtoDébito LINKS -----------');
	console.log(await respostaPgto.Payment.Links);
	console.log(await 'doPgtoDébito SPLIT ERRORS -----------');
	console.log(await respostaPgto.Payment.SplitErrors);

	sessao.pgto = pgtoDebito;
	if (respostaPgto.Payment && respostaPgto.Status == 1)
		pgtoDebito.setDadosPgto(respostaPgto.MerchantOrderId, respostaPgto.Payment.Status, respostaPgto.Payment.ProofOfSale, respostaPgto.Payment.PaymentId);

	resp.json(respostaPgto);
}

//-----------------------------------------------------------------------------------------//

async function doFinalizarPgtoDebito(req, resp) {
	resp.redirect('solicitacao.html');
}

//-----------------------------------------------------------------------------------------//

async function doPgtoBoleto(req, resp) {
	let sessao = recuperarSessao(req, resp);
	if (sessao == null) 
    return;

	let id = req.params.id;
	let nome = req.params.nome;
	let cpf = req.params.cpf;
	let celular = req.params.celular;
	let email = req.params.email;
	let valor = req.params.valor;
	let exame = req.params.exame;
	let dataPgto = req.params.dataPgto;

	console.log('executando doPgtoBoleto' + nome);
	if (
		typeof nome === 'undefined' ||
		typeof cpf === 'undefined' ||
		typeof celular === 'undefined' ||
		typeof email === 'undefined' ||
		typeof id === 'undefined' ||
		typeof valor === 'undefined' ||
		typeof exame === 'undefined' ||
		typeof dataPgto === 'undefined'
	) {
		console.log('undefined 0012');
		resp.json(JSON.parse('{"erro" : "[Erro:#0012] Solicitação Inválida"}'));
		return;
	}

	console.log('parâmetros ok doPgtoBoleto');

	let pgtoBoleto = new PgtoCredito(id, nome, cpf, celular, email, null, null, null, null, null, null, valor);

	let agora = new Date();
	let timeMillis = agora.getTime().toString();

	const myHeaders = {
		'Content-Type': 'application/json',
		MerchantId: '0c476fc2-f8f5-4e85-a60c-366463f210e2',
		MerchantKey: 'HHNUGBUVGJFMKHGMLWEWJIOEYFAXAKAJAWQCKAFB'
	};

	const myBody = {
		MerchantOrderId: id,
		Customer: {
			Name: nome,
			Identity: cpf,
			IdentityType: 'CPF',
			Phone: '55' + celular,
			Email: email,
			Birthdate: '1970-06-24'
		},
		Payment: {
			Provider: 'Simulado',   //### VER
			Type: 'Boleto',
			Amount: valor,
			BoletoNumber: id.replace('_', ''),
			Assignor: 'Interclínicas ...', //TODO
			Demonstrative: 'Pagamento referente ao Exame ' + exame,
			ExpirationDate: dataPgto,
			Identification: cpf,
			Instructions: 'Aceitar somente até a data de vencimento.',
			Currency: 'BRL',
			Country: 'BRA',
			SoftDescriptor: 'GuiaRosa'
		}
	};

	const requisicao = {
		method: 'POST',
		headers: myHeaders,
		body: JSON.stringify(myBody)
	};

	console.log('doPgtoBoleto --> ' + JSON.stringify(requisicao));
	const responseBraspag = await fetch('https://apisandbox.braspag.com.br/v2/sales/', requisicao);
	console.log('fetch doPgtoBoleto');
	const respostaPgto = await responseBraspag.json();
	console.log('json doPgtoBoleto');
	console.log(respostaPgto);

	sessao.pgto = pgtoBoleto;
	if (respostaPgto.Payment && respostaPgto.Payment.ReasonCode == 0)
		pgtoBoleto.setDadosPgto(respostaPgto.MerchantOrderId, respostaPgto.Payment.Status, respostaPgto.Payment.ProofOfSale, respostaPgto.Payment.PaymentId);

	resp.json(respostaPgto);
}

//-----------------------------------------------------------------------------------------//

async function doVerificarPgto(req, resp) {
	let sessao = recuperarSessao(req, resp);
	if (sessao == null) 
    return;

	if (sessao.pgto == null) 
    return null;

	let paymentId = sessao.pgto.paymentId;
	console.log('executando doVerificarPgto ' + paymentId);

	const myHeaders = {
		MerchantId: '0c476fc2-f8f5-4e85-a60c-366463f210e2',
		MerchantKey: 'HHNUGBUVGJFMKHGMLWEWJIOEYFAXAKAJAWQCKAFB'
	};

	const requisicao = {
		method: 'GET',
		headers: myHeaders
	};

	console.log('doVerificarPgto --> ' + JSON.stringify(requisicao));
	const responseBraspag = await fetch('https://apiquerysandbox.braspag.com.br/v2/sales/' + paymentId, requisicao);
	console.log('fetch doVerificarPgto');
	const resposta = await responseBraspag.json();
	console.log('json doVerificarPgto');
	console.log(resposta);
	console.log('json doVerificarPgto pgto');
	console.log(sessao.pgto);

	sessao.pgto.status = resposta.Payment.Status;

	resp.json(sessao);
}

//-----------------------------------------------------------------------------------------//

function doVerificarSenhaUsuarioCorrente(req, resp) {
	let sessao = recuperarSessao(req, resp);
	if (sessao == null) 
    return;
	let senha = req.body.senha;
  
	if (typeof senha === 'undefined') {
		resp.json(JSON.parse('{"erro" : "[Erro:#0010] Senha Não Informada."}'));
		return;
	}
	if (sessao.senha != senha) {
		resp.json(JSON.parse('{"erro" : "[Erro:#0011] Senha Não Confere."}'));
	} else {
		resp.json(JSON.parse('{"mensagem":"Ok"}'));
	}
}

//-----------------------------------------------------------------------------------------//

async function doGerarConfirmacao(req, resp) {
	let sessao = recuperarSessao(req, resp);
	if (sessao == null) 
    return;

	let nome = req.body.nome;
	let cpf = req.body.cpf;
	let numeroCartao = req.body.numeroCartao;
	let nomeCartao = req.body.nomeCartao;
	let bandeira = req.body.bandeira;
	let nomeExame = req.body.nomeExame;
	let nomeExecutante = req.body.nomeExecutante;
	let endereco = req.body.endereco;
	let valor = req.body.valor;
	let forma = req.body.forma;
	let merchantOrderId = req.body.merchantOrderId;
	let proofOfSale = req.body.proofOfSale;
	let paymentId = req.body.paymentId;
	let url = req.body.url;

	if (
		typeof nome === 'undefined' ||
		typeof cpf === 'undefined' ||
		typeof numeroCartao === 'undefined' ||
		typeof nomeCartao === 'undefined' ||
		typeof bandeira === 'undefined' ||
		typeof nomeExame === 'undefined' ||
		typeof nomeExecutante === 'undefined' ||
		typeof endereco === 'undefined' ||
		typeof valor === 'undefined' ||
		typeof forma === 'undefined' ||
		typeof merchantOrderId === 'undefined' ||
		typeof proofOfSale === 'undefined' ||
		typeof paymentId === 'undefined' ||
		typeof url === 'undefined'
	) {
		resp.json(JSON.parse('{"erro" : "[Erro:#0012] Solicitação Inválida"}'));
		return;
	}

	let pdf = new pdfDocument({bufferPages: true});
	let buffers = [];
	pdf.on('data', buffers.push.bind(buffers));
	pdf.on('end', () => {
		let pdfData = Buffer.concat(buffers);
		resp.setHeader('Content-type', 'application/pdf');
		resp.setHeader('Content-Length', Buffer.byteLength(pdfData));
		resp.setHeader('Content-disposition', 'attachment;filename=confirmacao_' + merchantOrderId + '.pdf');
		resp.send(pdfData);
		resp.end();
	});

	pdf.image('public/images/interclinicas.png', 150, 50, {fit: [300, 100]});
	pdf.font('public/fonts/SourceSansPro-SemiBold.ttf')
		.fontSize(25)
		.text('Voucher para Execução de Exame', 135, 120);

	pdf.font('public/fonts/SourceSansPro-SemiBold.ttf')
		.fontSize(14)
		.text('ID Guia Rosa: #', 80, 180, {continued: true})
		.font('public/fonts/SourceSansPro-Regular.ttf')
		.text(merchantOrderId + '\n');

	pdf.font('public/fonts/SourceSansPro-SemiBold.ttf')
		.text('Exame Agendado:\n', 80, 200)

	pdf.font('public/fonts/SourceSansPro-Regular.ttf')
		.text('       ' + nomeExame + '\n')
		.text('       ' + nomeExecutante + '\n')
		.text('       ' + endereco + '\n');

	pdf.font('public/fonts/SourceSansPro-SemiBold.ttf')
		.text('Valor: ', {continued: true})
		.font('public/fonts/SourceSansPro-Regular.ttf')
		.text('R$ ' + valor + '\n');

	pdf.font('public/fonts/SourceSansPro-SemiBold.ttf')
		.text('Agendado para: ', {continued: true})
		.font('public/fonts/SourceSansPro-Regular.ttf')
		.text(nome + ' (' + cpf + ')\n\n');

	if (forma == 'Cartão de Crédito') {
		numeroCartao = numeroCartao.substring(0, 4) + ' ' + numeroCartao.substring(4, 6) + 'XX XXXX XX' + numeroCartao.substring(14);

		pdf.font('public/fonts/SourceSansPro-SemiBold.ttf')
			.text('Pagamento efetuado com cartão de crédito: ', {continued: true})
			.font('public/fonts/SourceSansPro-Regular.ttf')
			.text(numeroCartao + ' (' + bandeira + ')\n');

		pdf.font('public/fonts/SourceSansPro-SemiBold.ttf')
			.text('Número da Autorização: ', {continued: true})
			.font('public/fonts/SourceSansPro-Regular.ttf')
			.text(proofOfSale + '\n');
	}
	pdf.font('public/fonts/SourceSansPro-SemiBold.ttf')
		.text('Identificação do Pagamento: ', {continued: true})
		.font('public/fonts/SourceSansPro-Regular.ttf')
		.text(paymentId + '\n');

	if (url != null && url != 'null') {
		url = url.replace(/%2F/g, '/');
		pdf.font('public/fonts/SourceSansPro-SemiBold.ttf')
			.text('Endereço para download do boleto: \n')
			.font('public/fonts/SourceSansPro-Regular.ttf')
			.fontSize(11)
			.text(url, {link: url, underline: true});
	}
	pdf.end();
	sessao.agendamento = null;
	sessao.pgto = null;
}

//-----------------------------------------------------------------------------------------//

async function doObterEnderecoPeloCep(req, resp) {
	let cep = req.body.cep;
	let response = await fetch('http://cep.republicavirtual.com.br/web_cep.php?cep=' + cep + '&formato=jsonp');
	let myJson = await response.json();
	resp.json(myJson);
}

//-----------------------------------------------------------------------------------------//

async function doObterIP(req, resp) {
	let ip = req.ip;
  resp.set('Content-Type', 'text/plain')
  resp.send(ip)
}

//-----------------------------------------------------------------------------------------//

function startServer() {
  // Instancio um objeto Server (Express). Todas as requisições serão tratadas por este objeto
	const app = express();

    // Servidor irá processar cookies
	app.use(cookieParser());

  
  app.use(express.urlencoded({extended: true}));
  app.use(express.json());
  
	// Se a requisição vier http, redireciono para https (requisito para PWA)
	app.use(   redirectToHTTPS([/localhost:(\d{4})/], [], 301)   );
    
  // Cria um application/json parser
  //var jsonParser = bodyParser.json();
  //console.log('bodyParser:  ' + JSON.stringify(express.json()));
  //console.log('bodyParser:  ' + JSON.stringify(jsonParser));

  // Efetuando o log para cada requisição
	app.use( (req, resp, next) => {
     
		const now = new Date();

    const dataFormatada = ((now.getDate() )) + "/" + ((now.getMonth() + 1)) + "/" + now.getFullYear(); 
    const options = {
      timeZone: 'America/Sao_Paulo', // Lista de Timezones no fim do artigo
      hour12: false, // Alterna entre a mostragem dos horários em 24 horas, ou então AM/PM
    }
		const hora = dataFormatada + '-' + now.toLocaleTimeString('pt-BR',options);
		const path = req.method + ' ' + req.path;
		const m = '(' + req.ip + ') - ' + hora + ' - ' + path + ' - Cookies: ' + JSON.stringify(req.cookies);
		console.log(m);
		next();
	});

	console.log('+----------------- ');
	console.log('| START SERVER ');
	console.log('+----------------- ');

	usuariosAtivos = new Map();

	//
	// Chamadas aos Serviços Remotos
	//

  // Iniciar
	app.get('/inicio', doInicio);

	// Login
	app.post('/login', doLoginMedico); 

	// Ambiente
	app.get('/ambiente', doObterAmbiente);

	// ClientId
	app.get('/clientid', doObterClientId);

	// Guardar Usuário Corrente
	app.post('/guardarUsuarioCorrente', doGuardarUsuarioCorrente);

	// Verificar Senha do Usuário Corrente
	app.post('/verificarSenha/', doVerificarSenhaUsuarioCorrente);

	// Obter Usuário Corrente
	app.get('/obterUsuarioCorrente', doObterUsuarioCorrente);

	// Incluir Usuario Paciente
	app.post('/incluirUsuarioPaciente', doIncluirUsuarioPaciente);

	// Incluir Paciente
	app.get('/incluirPaciente/', doIncluirPaciente);

	// Envio de Solicitação de Agendamento de Exame
	app.post('/agendamento', doAgendamento);

	// Pagamento por cartão de crédito
	app.post('/pgtocc', doPgtoCC);

	// Pagamento por cartão de debito
	app.get('/pgtodebito/:cpf/:nome/:celular/:email/:id/:numeroCartao/:nomeCartao/:bandeira/:mesValidade/:anoValidade/:valor/:merchantId/:perccomis', doPgtoDebito);
	app.post('/finalizarDebito', doFinalizarPgtoDebito);

	// Pagamento por boleto
  //###	app.get('/pgtoboleto/:cpf/:nome/:celular/:email/:id/:valor/:exame/:dataPgto/:merchantId/:perccomis', doPgtoBoleto);

	// Verificar status de pagamento
	app.get('/verificarPgto', doVerificarPgto);

	// Gerar PDF de resposta
	app.post('/gerarConfirmacao', doGerarConfirmacao);

	// obter dados pelo CEP
	app.post('/obterEnderecoPeloCep', doObterEnderecoPeloCep);

	// obter IP
	app.get('/obterIP', doObterIP);

	// Obter Locais
	app.get('/obterLocais/', doObterLocais);

	// Obter Período
	app.get('/obterPeriodo/', doObterPeriodo);

	// Obter Exames
	app.get('/obterExames/:local/:exame', doObterExames);

	// Verificar Tempo de Conexão
	app.get('/verificarTimeout/', doVerificarTimeout);

	// Inicializando dataPeriodo e Locais
	setPeriodo();
	setLocais();

	// Indicando ao express que os arquivos estáticos estão na pasta 'public'
	app.use(express.static('public'));

  // Indicando para obter o IP efetivo da requisição
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);
  
	// Iniciando o servidor local
	return app.listen('8000', () => {
		console.log('Servidor Local iniciado na porta 8000');
	});
}

//----------------------------------------------------------------------------------------//

//
// Início do Programa
//
startServer();
