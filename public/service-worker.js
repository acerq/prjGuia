"use strict";

const CACHE_NAME = "static-cache-v2";
const DATA_CACHE_NAME = "data-cache-v1";

var timeLogin = null;
var idSolicitante = null;
var lastCall = null;

const FILES_TO_CACHE = [
  "/",
  "/bdpaciente.html",
  "/burger.html",
  "/cadusuario.html",
  "/icones_medico.html",
  "/icones_paciente.html",
  "/index.html",
  "/inicio.html",
  "/listas.html",
  "/login.html",
  "/menu_medico.html",
  "/menu_paciente.html",
  "/menu_sem_usuario.html",
  "/offline.html",
  "/pgto_boleto.html",
  "/pgto_credito.html",
  "/pgto_debito.html",
  "/solicitacao.html",
  "/scripts/cadusuario.js",
  "/scripts/dao_paciente.js",
  "/scripts/download.js",
  "/scripts/install.js",
  "/scripts/jquery.js",
  "/scripts/jquery.maskedinput-1.4.1.pack.js",
  "/scripts/md5.min.js",
  "/scripts/nav.js",
  "/scripts/pgto.js",
  "/scripts/select2.js",
  "/scripts/uc_login.js",
  "/scripts/uc_paciente.js",
  "/scripts/uc_solicitacao.js",
  "/scripts/util.js",
  "/scripts/view_login.js",
  "/scripts/view_paciente.js",
  "/scripts/view_solicitacao.js",
  "/styles/select2.css",
  "/styles/inline.css"
];

self.addEventListener("install", evt =>  {
  console.log("[SW] Instalação");
  caches.keys().then(keyList => {
    return Promise.all(
      keyList.map(key => {
        if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
          console.log("[SW] Removendo cache antigo", key);
          return caches.delete(key);
        }
      })
    );
  });

  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[SW] Pré-caching dos arquivos" + cache);
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", evt => {
  console.log("[SW] Activate");
  evt.waitUntil(
    caches.keys().then(keyList => {
      return Promise.all(
        keyList.map(key => {
          if (key !== CACHE_NAME && key !== DATA_CACHE_NAME) {
            console.log("[SW] Removendo cache antigo", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});
