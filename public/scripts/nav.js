const divConteudo = document.getElementById("divConteudo");
var usrApp = null;
var inicio = false;

$("#hdr").load("burger.html");

// -----------------------------------------------------------------------------------------//

doObterUsuarioCorrente().then(retorno => {
  console.log("abrirApp retorno", retorno);
  renderObterUsuarioCorrente(retorno);
});

// -----------------------------------------------------------------------------------------//

setTimeout(function() {
  $("div.burger").on(click, function() {
    if (!$(this).hasClass("open")) {
      openMenu();
    } else {
      closeMenu();
    }
  });
}, 1000);

// -----------------------------------------------------------------------------------------//

if ("ontouchstart" in window) {
  var click = "click";
} else {
  var click = "click";
}

$("div.burger").on(click, function() {
  if (!$(this).hasClass("open")) {
    openMenu();
  } else {
    closeMenu();
  }
});

$("div.menu ul li a").on(click, function(e) {
  e.preventDefault();
  closeMenu();
});


function openMenu() {
  $("div.circle").addClass("expand");

  $("div.burger").addClass("open");
  $("div.x, div.y, div.z").addClass("collapse");
  $(".menu li").addClass("animate");

  setTimeout(function() {
    $("div.y").hide();
    $("div.x").addClass("rotate30");
    $("div.z").addClass("rotate150");
  }, 70);
  setTimeout(function() {
    $("div.x").addClass("rotate45");
    $("div.z").addClass("rotate135");
  }, 120);

  var conteudo = document.getElementById("divConteudo");
  conteudo.hidden = true;
}

function closeMenu() {
  $("div.burger").removeClass("open");
  $("div.x")
    .removeClass("rotate45")
    .addClass("rotate30");
  $("div.z")
    .removeClass("rotate135")
    .addClass("rotate150");
  $("div.circle").removeClass("expand");
  $(".menu li").removeClass("animate");

  setTimeout(function() {
    $("div.x").removeClass("rotate30");
    $("div.z").removeClass("rotate150");
  }, 50);
  setTimeout(function() {
    $("div.y").show();
    $("div.x, div.y, div.z").removeClass("collapse");
  }, 70);
  const conteudo = document.getElementById("divConteudo");
  conteudo.hidden = false;
}

// -----------------------------------------------------------------------------------------//

function doObterUsuarioCorrente() {
  console.log("(app.js) Executando doLoad ");
  return fetch("/obterUsuarioCorrente")
    .then(response => {
      console.log("(app.js) doObterUsuarioCorrente response", response.body);
      return response.json();
    })
    .catch(e => {
      console.log("(app.js) doObterUsuarioCorrente catch", e);
      return null;
    });
}

// -----------------------------------------------------------------------------------------//

function renderObterUsuarioCorrente(retorno) {
  usrApp = retorno;
  if (usrApp.ehMedico) 
	  $("#menu").load("menu_medico.html");
  else 
	  $("#menu").load("menu_paciente.html");

  if (inicio) {
    console.log(usrApp);
    divConteudo.innerHTML = "";
    if (usrApp.ehMedico)
      divConteudo.innerHTML +=
        "<center><b>Atendimento a Médicos</center></b><br/>";
    divConteudo.innerHTML +=
      "<center><b>Bem-vindo(a)</b> " +
      usrApp.nome +
      "&nbsp;&nbsp;(" +
      usrApp.login +
      ")</center>";
  }
}

// -----------------------------------------------------------------------------------------//

function cadastroDePacientes() {
  window.location.href = "cadastro.html";
}

// -----------------------------------------------------------------------------------------//

function solicitacaoDeExames() {
  window.location.href = "solicitacao.html";
}

// -----------------------------------------------------------------------------------------//

window.retornarUsrApp = function() {
  return usrApp;
};

// -----------------------------------------------------------------------------------------//

function abrirApp() {
  inicio = true;
}

// -----------------------------------------------------------------------------------------//

function fecharApp() {
	try {
		navigator.app.exitApp();
	}
	catch(e) {
		var tamHistory = window.history.length;
	    while(tamHistory > 0) {
	    	window.history.go(-1);
	    	tamHistory--;
	    }
	}
}

// -----------------------------------------------------------------------------------------//

function colocarEspera() {
  $("div.circle").addClass("wait");
}

// -----------------------------------------------------------------------------------------//

function tirarEspera() {
  $("div.circle").removeClass("wait");
}

// -----------------------------------------------------------------------------------------//
