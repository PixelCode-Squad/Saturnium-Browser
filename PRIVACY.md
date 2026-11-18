# Política de Privacidade — SaturniumBrowser

**Última atualização:** 7 de novembro de 2026  
**Versão do aplicativo revisada:** 1.2.5

Esta política descreve o tratamento de informações identificado no código-fonte do SaturniumBrowser. O navegador é um projeto open source desenvolvido por Jefferson Passarelli Santos (`@Jeffin-PVP`). Esta política deve ser revisada sempre que funcionalidades, provedores ou integrações de rede forem alterados.

## 1. Resumo

- O histórico, os registros de downloads, as configurações e os dados das extensões são armazenados localmente no computador.
- O SaturniumBrowser não implementa, no código-fonte revisado da versão 1.2.5, um serviço próprio de conta, sincronização em nuvem, publicidade comportamental ou analytics centralizado.
- Algumas funções se conectam a serviços de terceiros. Essas conexões podem transmitir dados técnicos da conexão e os dados necessários para a função solicitada.
- O conteúdo enviado ao provedor de IA escolhido pelo usuário é transmitido a esse provedor. Provedores locais podem processar as solicitações no próprio computador.

A ausência de uma implementação própria de analytics no código revisado não significa que sites visitados, provedores externos, o sistema operacional ou o Electron não processem dados conforme suas próprias políticas.

## 2. Informações armazenadas localmente

O aplicativo armazena localmente, conforme os recursos utilizados:

| Dados | Finalidade e armazenamento |
|---|---|
| Histórico de navegação | URLs, títulos, favicons e datas de visita; arquivo local `history.json`. |
| Histórico de downloads | Informações dos downloads, como nome, caminho, estado e metadados; arquivo local `downloads.json`. Os arquivos baixados permanecem na pasta escolhida pelo usuário. |
| Dados e configurações de extensões | Arquivos JSON locais no diretório de dados do aplicativo. O conteúdo varia por extensão. |
| Notas | Conteúdo das notas da extensão Saturnium Notes, armazenado localmente. |
| Cofre de senhas | O cofre da extensão Saturnium Passwords é criptografado pela implementação da extensão com uma senha mestra. A chave de desbloqueio é mantida em memória enquanto o cofre está desbloqueado e há bloqueio automático após cinco minutos de inatividade. |
| Configuração de IA | Provedor, modelo, endpoint e preferências. As chaves de API são protegidas com `safeStorage` do Electron quando a criptografia está disponível no ambiente. |
| Cache de segurança | Listas de URLs/domínios identificados por feeds públicos, armazenadas localmente. |
| Logs de atualização | Registros técnicos do `electron-updater`, gravados localmente em `updater.log`. |

A localização exata do diretório de dados pode variar conforme a versão do Windows e a configuração do Electron. O histórico e os downloads usam a pasta `SaturniumBrowser` dentro de `%APPDATA%`; outros módulos usam o diretório `userData` fornecido pelo Electron.

## 3. Conexões com serviços externos

### 3.1 Sites visitados

Quando o usuário abre um site, o computador se conecta ao domínio escolhido. O site e seus recursos incorporados podem receber informações técnicas usuais da conexão, como endereço IP, dados do navegador, cookies e informações que o próprio usuário decidir fornecer. O tratamento desses dados é regido também pelas políticas dos respectivos sites.

### 3.2 Pesquisa na web

Ao pesquisar pela barra de endereço ou pelas páginas de pesquisa, os termos pesquisados são enviados aos provedores usados pelo código: Bing Search/RSS, Mojeek e, como alternativa, Bing HTML. Pesquisas de imagens, vídeos e notícias também utilizam endpoints do Bing.

A pesquisa de mapas utiliza o serviço Nominatim do OpenStreetMap. A interface de mapas pode carregar conteúdo incorporado do OpenStreetMap. A página de resultados também solicita ícones de domínio ao serviço de ícones do DuckDuckGo e pode carregar miniaturas de vídeos do YouTube.

Esses provedores podem receber o termo pesquisado, endereço IP, informações técnicas da solicitação e outros dados definidos por seus próprios serviços.

### 3.3 Verificação de segurança

Na inicialização, o módulo de segurança tenta baixar listas públicas de URLs maliciosas do URLhaus e do OpenPhish. As listas são armazenadas em cache local e a atualização respeita um intervalo mínimo de seis horas. Essa consulta transmite uma solicitação aos serviços, que podem receber dados técnicos de conexão. O navegador usa essas listas e heurísticas locais para auxiliar na identificação de endereços suspeitos; elas não garantem proteção completa.

### 3.4 Atualizações do aplicativo

O `electron-updater` verifica atualizações no repositório público de releases do SaturniumBrowser no GitHub. O código revisado agenda uma verificação após a inicialização e verificações periódicas a cada 30 minutos. Quando uma atualização é encontrada, ela é baixada automaticamente e pode ser instalada ao fechar ou reiniciar o aplicativo. O GitHub pode receber dados técnicos da conexão e da solicitação de atualização.

### 3.5 Assistente SaturniumAI

O usuário escolhe o provedor. Quando um provedor remoto é selecionado, as mensagens enviadas ao assistente e os parâmetros da solicitação são transmitidos ao serviço correspondente:

- OpenAI — `api.openai.com`;
- Groq — `api.groq.com`;
- Google Gemini — `generativelanguage.googleapis.com`;
- provedor personalizado — endpoint HTTPS configurado pelo usuário.

O provedor remoto pode processar e reter esses dados segundo seus próprios termos e políticas. O usuário deve consultar as políticas do provedor antes de enviar informações pessoais, confidenciais ou sensíveis. O teste de conexão também envia uma mensagem de teste ao provedor selecionado.

As integrações com `llama.cpp` e Ollama usam por padrão endpoints locais (`127.0.0.1`). O provedor personalizado também pode apontar para um serviço local, quando configurado para localhost. Se o usuário configurar outro endpoint remoto permitido, os dados serão enviados a esse endpoint.

### 3.6 Extensão Dictionary

A extensão de dicionário consulta `dictionaryapi.dev` para palavras em inglês e Wiktionary para português e espanhol. A palavra consultada é enviada ao serviço correspondente. O histórico e a lista de palavras salvas pela extensão permanecem no armazenamento local do navegador.

### 3.7 Extensões e permissões

As extensões oficiais possuem permissões declaradas em seus manifests. A extensão Dictionary tem acesso de rede limitado aos hosts declarados no manifesto. A extensão Passwords pode escrever dados na área de transferência e preencher campos de login quando o usuário aciona essa função e o domínio corresponde ao cadastro. A área de transferência é um recurso do sistema operacional e pode ser acessível a outros aplicativos em execução.

O sistema de Desempenho funciona inteiramente no computador: mede o uso de memória e CPU dos processos do próprio navegador, não envia nenhum dado a serviços externos e guarda apenas suas preferências (limites e opções) em `performance.json`. Títulos e endereços das abas aparecem na página de desempenho somente para você e não são gravados. Uma aba suspensa mantém título, ícone e histórico de navegação em memória até ser reativada ou fechada.

A extensão AdBlock funciona inteiramente no computador: ela não faz requisições de rede próprias e não envia dados a nenhum serviço. As listas de domínios ficam dentro do aplicativo. Os sites liberados, os domínios personalizados e o contador total de bloqueios ficam no armazenamento local da extensão. Os domínios mais bloqueados da sessão são mantidos apenas em memória.

Extensões instaladas de outras fontes podem ter comportamento diferente. Instale apenas extensões em que confia e revise suas permissões e seu código.

## 4. Compartilhamento e venda de dados

O projeto não possui, no código-fonte revisado, um servidor próprio que receba centralmente o histórico de navegação, downloads, notas ou cofre de senhas. O projeto não vende dados pessoais.

Isso não impede que os serviços externos escolhidos ou acessados pelo usuário recebam os dados descritos nesta política, nem substitui os termos e políticas desses serviços.

## 5. Segurança

O projeto utiliza armazenamento local para dados do navegador, `safeStorage` do Electron para proteger chaves de API quando disponível e criptografia própria no cofre de senhas. Essas medidas reduzem determinados riscos, mas não tornam o computador ou o aplicativo imunes a malware, acesso físico, comprometimento da conta do Windows, extensões maliciosas ou vulnerabilidades.

Não use o cofre como única cópia de informações importantes. Proteja a senha mestra e mantenha o sistema operacional atualizado.

## 6. Escolhas e controle do usuário

O usuário pode:

- escolher se deseja utilizar o assistente de IA e qual provedor configurar;
- não utilizar as funções de pesquisa, mapas ou dicionário que consultam serviços externos;
- limpar o histórico pela interface do navegador;
- remover dados de extensões pelas respectivas funções, quando disponíveis;
- desinstalar o aplicativo e, se desejar, apagar manualmente as pastas locais de dados do SaturniumBrowser no Windows.

A desinstalação pode não apagar todos os dados de usuário. Antes de excluir manualmente os diretórios de dados, faça cópias de segurança de notas, configurações ou outros dados que deseje manter. Apagar os dados locais do cofre de senhas pode tornar as senhas armazenadas irrecuperáveis.

## 7. Crianças e adolescentes

O SaturniumBrowser é um navegador de uso geral e não foi projetado como serviço de coleta de dados de crianças. Pais ou responsáveis devem acompanhar o uso de serviços externos, especialmente provedores de IA e sites que solicitem informações pessoais.

## 8. Alterações nesta política

Esta política poderá ser atualizada quando houver mudanças no aplicativo, nos serviços integrados ou nas práticas de privacidade. A data no início do documento indica a revisão mais recente publicada.

## 9. Contato

Para dúvidas ou solicitações relacionadas a esta política, utilize o repositório oficial: <https://github.com/Jeffin-PVP/SaturniumBrowser>. Não publique senhas, chaves de API, dados pessoais ou detalhes privados de segurança em issues públicos.

## 10. Políticas de privacidade de serviços de terceiros

As políticas abaixo pertencem aos respectivos operadores e podem mudar independentemente do SaturniumBrowser. Elas explicam o tratamento realizado por cada serviço, não pelo aplicativo:

- Microsoft/Bing: <https://privacy.microsoft.com/privacystatement>
- Mojeek: <https://www.mojeek.com/about/privacy/>
- DuckDuckGo (ícones de domínio): <https://duckduckgo.com/privacy>
- OpenStreetMap Foundation: <https://osmfoundation.org/wiki/Privacy_Policy>
- OpenAI API: <https://openai.com/policies/privacy-policy/>
- Groq: <https://groq.com/privacy-policy>
- Google/Gemini e YouTube: <https://policies.google.com/privacy>
- Wikimedia/Wiktionary: <https://foundation.wikimedia.org/wiki/Policy:Privacy_policy>
- GitHub (atualizações e releases): <https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement>
- Dictionary API: <https://dictionaryapi.dev/>

URLhaus e OpenPhish são utilizados para baixar feeds públicos de segurança. Consulte os próprios sites para informações atuais sobre seus serviços: <https://urlhaus.abuse.ch/> e <https://openphish.com/>.
