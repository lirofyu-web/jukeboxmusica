
# JUKEBOX MONTANHA - Versão USB Direta

Esta Jukebox foi otimizada para rodar em Box Android ou PC de forma totalmente offline, lendo arquivos diretamente de um Pendrive ou HD Externo.

## 📁 Estrutura do USB

Para que o app identifique suas músicas, crie uma pasta chamada **`jukeboxmontanha1`** na raiz do seu USB com a seguinte organização:

```text
USB Drive/
└── jukeboxmontanha1/
    ├── backgrounds/         <-- Vídeos MP4 para tocar ao fundo das músicas
    ├── Album Sertanejo/     <-- Pasta com nome do álbum
    │   ├── capa.jpg         <-- Imagem do álbum
    │   ├── musica1.mp3
    │   └── musica2.mp3
    └── Album Rock/
        ├── cover.png
        └── video-clipe.mp4  <-- Suporta clipes de vídeo também
```

## 🚀 Como Sincronizar

1.  Conecte o USB na Box Android.
2.  Abra o app e pressione a tecla **'M'** (Menu).
3.  Clique em **"Sincronizar jukeboxmontanha1"**.
4.  Selecione a unidade USB quando o navegador solicitar.
5.  O app salvará automaticamente os metadados e capas no banco de dados interno para acesso rápido.

## 🛠️ Funcionalidades

- **Zero Internet**: Funciona 100% offline após a primeira sincronização.
- **Persistência de Créditos**: O saldo em dinheiro não é perdido ao reiniciar.
- **Modo Quiosque**: Interface sem cursor de mouse, ideal para totens.
- **Fila de Espera**: Gerenciamento automático de pedidos.

## ⌨️ Atalhos de Teclado (Hardware)

- `M`: Painel do Operador / Configurações.
- `C` ou `5`: Inserir Crédito (Moedeiro).
- `+` / `-`: Volume.
- `Setas`: Navegação entre álbuns e músicas.
- `Enter`: Selecionar / Confirmar.
- `Esc` / `Backspace`: Voltar.
