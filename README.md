# 🪐 SaturniumBrowser

![SaturniumBrowser](assets/saturniumbrowser-icon.png)

**Um navegador desktop desenvolvido com Electron, com ferramentas integradas, assistente de IA e suporte a extensões próprias.**

<div align="center">

![Version](https://img.shields.io/badge/version-1.2.5-7C5CFF?style=for-the-badge)
![Electron](https://img.shields.io/badge/Electron-44.1.0-47848F?style=for-the-badge&logo=electron&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Platform](https://img.shields.io/badge/platform-Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

</div>

---

## 📖 Sobre o projeto

O **SaturniumBrowser** é um navegador desktop desenvolvido utilizando Electron e JavaScript.

O projeto reúne navegação por abas, gerenciamento de histórico e downloads, pesquisa na web, verificações de segurança, extensões próprias e um assistente de inteligência artificial configurável.

O objetivo é desenvolver um navegador independente, com funcionalidades integradas e possibilidade de expansão por meio de extensões.

## ✨ Funcionalidades

### 🌐 Navegação

- Navegação por múltiplas abas.
- Criar, fechar e alternar entre abas.
- Voltar e avançar páginas.
- Recarregar e interromper carregamentos.
- Barra de endereço e pesquisa.
- Abas fixadas.
- Reabrir abas fechadas recentemente.
- Indicadores de carregamento e informações de navegação.

### 🔎 Pesquisa

O SaturniumBrowser possui um sistema próprio de pesquisa.

Provedores encontrados na implementação:

- Bing Search RSS.
- Mojeek.
- Bing HTML como alternativa.

Também existem rotinas específicas para pesquisas de:

- Imagens.
- Vídeos.
- Notícias.
- Mapas.

Os resultados dependem da disponibilidade e das respostas dos serviços externos.

### 📚 Histórico

- Registro de páginas visitadas.
- Armazenamento local.
- Exibição do histórico em página própria.
- Limpeza do histórico.

### ⭐ Favoritos

- Adicionar e remover a página atual pela estrela na barra de endereço.
- Barra de favoritos com atalhos para páginas e pastas.
- Organização em pastas pela página `saturnium://bookmarks`.
- Importação e exportação no formato HTML de favoritos.

### 📥 Downloads

- Gerenciamento de downloads.
- Acompanhamento de progresso.
- Cancelamento de downloads.
- Abertura de arquivos baixados.
- Exibição do arquivo na pasta.
- Registro persistente dos downloads.
- Verificação de riscos em determinados arquivos.

### 🛡️ Segurança

O navegador possui um sistema próprio de verificação de endereços.

Fontes utilizadas:

- URLhaus.
- OpenPhish.

Também existem verificações heurísticas para identificar determinados padrões suspeitos, incluindo:

- Domínios com Punycode.
- Endereços IP associados a caminhos de login.
- Possíveis imitações de marcas conhecidas.

As listas são armazenadas em cache, com intervalo de atualização de seis horas.

**Importante:** essas verificações são mecanismos complementares. Não substituem soluções profissionais de proteção, não garantem a identificação de todas as ameaças e podem apresentar falsos positivos.

### 🤖 SaturniumAI

O SaturniumAI é o assistente de inteligência artificial integrado ao navegador.

O projeto possui suporte a diferentes provedores:

| Provedor | Integração |
|---|---|
| llama.cpp | Local |
| Ollama | Local |
| Groq | API |
| OpenAI | API |
| Gemini | API |
| Custom | Endpoint configurável |

Recursos encontrados:

- Configuração do provedor ativo.
- Configuração de modelos.
- Configuração de endpoints.
- Configuração de chaves de API.
- Teste de conexão.
- Envio de mensagens.
- Interrupção de requisições em andamento.

As chaves são protegidas utilizando o mecanismo `safeStorage` do Electron. A disponibilidade da criptografia depende do ambiente.

### 🧩 Extensões

O SaturniumBrowser possui um gerenciador próprio de extensões.

O sistema permite:

- Carregar extensões oficiais.
- Ativar e desativar extensões.
- Armazenar configurações das extensões.
- Abrir páginas de configuração.
- Verificar permissões declaradas.
- Executar métodos disponibilizados pelas extensões.

As extensões oficiais identificadas no código são:

| Extensão | Descrição |
|---|---|
| 🛡️ AdBlock | Bloqueio de anúncios e rastreadores de terceiros, com sites liberados e lista própria |
| 🌙 Dark Pages | Filtros visuais e modo escuro para páginas |
| 📖 Dictionary | Consulta de palavras e definições |
| 📺 Miniplayer | Picture-in-Picture para vídeos |
| 📝 Notes | Bloco de notas com armazenamento |
| 🔐 Passwords | Cofre de senhas e preenchimento de login |
| 🔍 Zoom | Configurações de zoom por domínio |

As extensões utilizam manifests e uma API interna de permissões.

## ⚡ Desempenho

Abra pelo menu **Desempenho** ou digitando `saturnium://performance`. A página mostra RAM e CPU em tempo real e permite ajustar:

| Opção | O que faz |
|---|---|
| Perfis (Desempenho / Equilibrado / Econômico) | Combinações prontas dos controles abaixo |
| Limite de RAM | Ao passar do teto, suspende as abas em segundo plano usadas há mais tempo |
| Limite de CPU | Rebaixa a prioridade das abas de fundo e, se o excesso persistir, suspende a que mais consome |
| Suspender abas inativas | Libera a memória de abas paradas há 5 min a 2 h |
| Prioridade menor em segundo plano | A aba em uso fica mais fluida com o computador ocupado |
| Aceleração por hardware / teto de memória JS por aba | Avançado; **exigem reiniciar** o navegador |

Abas suspensas continuam na barra (esmaecidas) e recarregam, com o histórico de voltar/avançar, ao serem clicadas. A aba ativa, abas tocando áudio, carregando, fixadas (opcional) e páginas internas nunca são suspensas.

**Limites são metas, não travas:** o sistema operacional não permite fixar um programa exatamente em X MB ou X% de CPU. O navegador mede a cada 5 segundos e age sobre as abas em segundo plano; se a aba ativa sozinha passar do limite, ele avisa, mas não a restringe. As configurações ficam em `performance.json` na pasta de dados do app.

**AdBlock:** a extensão informa listas de domínios (`extensions/official/saturnium-adblock/filters/`) e o navegador decide o bloqueio no mesmo ponto onde já cancela domínios maliciosos. Apenas requisições de terceiros são bloqueadas; a navegação principal e as páginas internas nunca são filtradas. Funciona por domínio, então não remove anúncios veiculados pelo próprio domínio do site (como os anúncios dentro de vídeos do YouTube). Para editar as listas, adicione um domínio por linha nos arquivos `ads.txt` e `trackers.txt`.

**Observação:** a existência do código de uma extensão não significa que todos os sites ou situações sejam compatíveis com ela.

### 🎨 Interface

- Interface personalizada.
- Barra de abas.
- Barra de navegação.
- Controles da janela.
- Página inicial própria.
- Indicadores visuais.
- Barra de downloads.
- Páginas internas para ferramentas do navegador.

---

## 🛠️ Tecnologias utilizadas

| Tecnologia | Utilização |
|---|---|
| Electron | Aplicação desktop |
| JavaScript | Lógica da aplicação |
| HTML5 | Estrutura das interfaces |
| CSS3 | Estilização |
| Node.js | Ambiente de execução |
| electron-builder | Empacotamento |
| electron-updater | Atualizações |

## 📦 Instalação para desenvolvimento

### Pré-requisitos

- Windows.
- Node.js.
- npm.

### Clonar o repositório

```bash
git clone https://github.com/Jeffin-PVP/SaturniumBrowser.git
```

### Entrar na pasta

```bash
cd SaturniumBrowser
```

### Instalar dependências

```bash
npm install
```

### Executar

```bash
npm start
```

## 🏗️ Compilação

Para gerar o instalador do Windows:

```bash
npm run build
```

O projeto utiliza electron-builder com destino NSIS.

O diretório de saída configurado é:

```text
dist/
```

Para gerar localmente um instalador sem publicá-lo:

```bash
npm run release
```

Esse comando **não publica** uma release no GitHub. A preparação de releases assinados, após a aprovação e configuração da SignPath Foundation, está documentada em [RELEASE_GUIDE.md](RELEASE_GUIDE.md).

## 📁 Estrutura do projeto

Estrutura baseada nos caminhos identificados no repositório:

```text
SaturniumBrowser/
│
├── assets/
│
├── extensions/
│   └── official/
│
├── src/
│   ├── ai/
│   │   └── providers/
│   │
│   ├── browser/
│   │
│   ├── downloads/
│   │
│   ├── extensions/
│   │
│   ├── history/
│   │
│   ├── search/
│   │
│   ├── security/
│   │
│   └── updater/
│
├── main.js
├── preload.js
├── index.html
├── style.css
├── newtab.html
├── history.html
├── downloads.html
├── search.html
├── extensions.html
├── blocked.html
├── saturnium-ai.html
└── package.json
```

## 🔄 Atualizações

O projeto utiliza `electron-updater` e está configurado para:

- Verificar atualizações.
- Baixar atualizações automaticamente.
- Instalar atualizações baixadas ao fechar o aplicativo.
- Ignorar versões marcadas como pré-lançamento.

O funcionamento depende da publicação correta dos arquivos de atualização e dos metadados exigidos pelo electron-updater.

## ⚠️ Limitações e observações

- O navegador depende do Electron e dos recursos disponibilizados por ele.
- A pesquisa depende de serviços externos e pode deixar de funcionar se os provedores alterarem suas páginas ou endpoints.
- A verificação de segurança não é uma garantia contra malware ou phishing.
- Os provedores de IA podem exigir chaves de API e acesso à internet.
- Os provedores locais exigem que seus respectivos serviços estejam instalados e funcionando.
- O funcionamento das extensões pode variar conforme o site visitado.
- Não há garantia de compatibilidade com todos os sites.

## 🔐 Privacidade e assinatura de código

- [Política de Privacidade](PRIVACY.md)
- [Code Signing Policy](CODE_SIGNING_POLICY.md)
- [Inventário de licenças de dependências](THIRD_PARTY_NOTICES.md)
- [Créditos e origem dos recursos visuais](ASSET_CREDITS.md)
- [Política de segurança e reporte de vulnerabilidades](SECURITY.md)
- [Guia de preparação de releases assinados](RELEASE_GUIDE.md)

**Situação da assinatura:** a integração com a SignPath Foundation está em preparação e ainda não está ativa. Os instaladores só devem ser anunciados como assinados depois que o projeto for aceito, a assinatura for concluída e a assinatura Authenticode for validada.

---

## 📌 Estado do projeto

O SaturniumBrowser está em desenvolvimento contínuo.

Esta documentação descreve funcionalidades identificadas no código-fonte. Não representa uma certificação de segurança, compatibilidade universal ou garantia de funcionamento de serviços externos.

## 👨‍💻 Desenvolvimento

Desenvolvido por **Jeffin-PVP**.

- GitHub: https://github.com/Jeffin-PVP
- Repositório: https://github.com/Jeffin-PVP/SaturniumBrowser

---

<div align="center">

**🪐 SaturniumBrowser**

*Seu navegador, seu espaço.*

</div>