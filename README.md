# Chá de Casa Nova: como colocar no ar

A página é estática (HTML, CSS e JS, sem build). As reservas, fotos e itens ficam no Supabase, com atualização ao vivo para todo mundo que abrir o link. Os convidados não precisam de login. Só os anfitriões entram, para editar.

## Arquivos

- `index.html`, `css/style.css`, `js/app.js`: a página
- `js/config.js`: o único arquivo que você precisa editar (URL e chave do Supabase, título, data)
- `js/seed.js`: a lista usada só no modo demonstração
- `supabase/schema.sql`: cria o banco, as regras de segurança, o espaço das fotos e a lista inicial (61 itens)

## 1. Criar o banco no Supabase (10 min)

1. Em supabase.com, crie um projeto novo (ex.: `cha-casa-nova`). Use um projeto separado do app da ORBITA, para as tabelas não se misturarem.
2. Abra `supabase/schema.sql` e, no final do arquivo, troque `SEU_EMAIL@exemplo.com` e `EMAIL_DA_OUTRA_PESSOA@exemplo.com` pelos e-mails dos anfitriões. Se for só um, apague a outra linha e a vírgula.
3. No Supabase: **SQL Editor > New query**. Cole o arquivo inteiro e clique em **Run**. Deve aparecer "Success".
4. **Authentication > Users > Add user > Create new user.** Use o mesmo e-mail do passo 2, crie uma senha e marque **Auto Confirm User**. Repita para o outro anfitrião.
5. (Recomendado) **Authentication > Sign In / Providers**: desligue **Allow new users to sign up**. Ninguém mais consegue criar conta.
6. **Project Settings > API Keys** (ou **Data API**): copie a **Project URL** e a chave pública (**publishable**, que começa com `sb_publishable_`, ou a **anon** antiga).

## 2. Ligar a página ao banco

Abra `js/config.js` e cole:

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_...';
```

A chave pública pode ficar no código. Quem protege os dados são as regras do `schema.sql`. Nunca cole a chave **secret / service_role**.

## 3. Publicar na Vercel

**Pelo GitHub (mais fácil de atualizar depois):**
1. No GitHub, crie um repositório novo (ex.: `cha-casa-nova`).
2. Clique em **uploading an existing file** e arraste **o conteúdo** da pasta (index.html, css, js, supabase, README.md). Clique em **Commit changes**.
3. Na Vercel: **Add New > Project > Import** esse repositório. Em Framework Preset escolha **Other**. Sem build command. Clique em **Deploy**.
4. Em 1 minuto sai o link `https://cha-casa-nova.vercel.app` (ou parecido). Para trocar o nome: **Settings > Domains**.

**Pela linha de comando (alternativa):** dentro da pasta, rode `npx vercel` e depois `npx vercel --prod`.

## 4. Conferir e personalizar

1. Abra o link. O aviso "Modo demonstração" **não** pode aparecer. Se aparecer, o `config.js` está errado.
2. No rodapé, toque em **Área dos anfitriões** e entre com o e-mail e a senha do passo 1.4.
3. Com **Editar lista** ligado, cada item ganha um botão **Editar**:
   - **Foto**: envie do celular ou do computador (é reduzida automaticamente), ou cole o link de uma imagem de loja.
   - **Cores aceitas**: nome e cor. O convidado escolhe uma ao reservar.
   - **Tamanhos aceitos**: separados por vírgula (ex.: `P, M, G` ou `1,5 m, 2 m`).
   - **Excluir item** ou **Novo item aqui** em cada cômodo.
4. Teste o ao vivo: abra o link no celular e no computador, reserve no celular e veja o item mudar no computador.
5. **Copiar resumo** gera o texto de quem leva o quê, pronto para colar no WhatsApp.

## Como funciona

- Cada item só aceita uma reserva. O banco garante isso: se duas pessoas tocarem ao mesmo tempo, a segunda recebe "Outra pessoa acabou de reservar".
- O convidado pode desistir do próprio item no mesmo aparelho em que reservou. Os anfitriões podem liberar qualquer reserva.
- Para mudar título, data ou texto de abertura, edite `EVENT` em `js/config.js`.
- Para mudar algo depois de publicado pelo GitHub: edite o arquivo no próprio GitHub e a Vercel atualiza sozinha.
