# Configuração de Modo Kiosk (Lubuntu)

Para fazer o Jukebox ser a única coisa que aparece ao ligar o computador, siga estes passos no seu Lubuntu:

## 1. Ocultar a Área de Trabalho e Barra de Tarefas
Abra o terminal e execute estes comandos para deixar o fundo preto e remover os ícones:
```bash
# Define cor preta no fundo
pcmanfm-qt --set-wallpaper="" --wallpaper-mode=color --desktop-off

# Para esconder a barra de tarefas permanentemente no autostart:
# Edite o arquivo de sessão do LXQt (ou use o menu Configurações de Sessão)
```

## 2. Configurar Autostart em Modo Tela Cheia
Crie um arquivo de inicialização:
`nano ~/.config/autostart/jukebox.desktop`

Cole o conteúdo abaixo (ajuste o caminho se necessário):
```desktop
[Desktop Entry]
Type=Application
Name=Jukebox Kiosk
Exec=google-chrome --kiosk --app=http://localhost:3000 --no-first-run --simulate-outdated-no-au
Terminal=false
```

## 3. Login Automático (Sem Senha)
Certifique-se que o Lubuntu está configurado para **Login Automático** nas configurações de Usuários.

---

# Nova Introdução (Splash Screen)
Já ciei o componente `src/components/jukebox/splash-screen.tsx` com:
- Animação de entrada do logo.
- Barra de progresso "Iniciando Hardware...".
- Efeito de brilho (Glow) premium.
- Duração de aproximadamente 4.5 segundos antes de mostrar as músicas.
