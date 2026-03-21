# ⚠️ PASSO CRÍTICO: Reiniciar o PowerShell

## 🔴 Por que os comandos ainda não funcionam?

Você instalou o Git, mas o PowerShell que está aberto **ainda não sabe** que o Git foi instalado. O Windows precisa recarregar as variáveis de ambiente.

## ✅ O QUE FAZER AGORA (IMPORTANTE!)

### 1️⃣ Fechar TUDO
- ❌ Feche TODAS as janelas do PowerShell
- ❌ Feche o VS Code (se estiver aberto)
- ❌ Feche qualquer terminal aberto

### 2️⃣ Abrir NOVO PowerShell
- ✅ Abra um NOVO PowerShell
- ✅ Ou abra o VS Code novamente (ele abrirá um novo terminal)

### 3️⃣ Testar se funcionou

No NOVO PowerShell, execute:

```powershell
git --version
```

**Se aparecer algo como**: `git version 2.XX.X`
✅ **SUCESSO!** O Git está funcionando!

**Se ainda der erro**: O Git não foi instalado corretamente. Reinstale marcando a opção "Git from command line".

### 4️⃣ Depois de confirmar que o Git funciona

Execute os comandos para publicar:

```powershell
# Navegar para a pasta
cd "c:\Users\Rafael\Desktop\ADC MOVEIS ELETRO (VPS)"

# Configurar Git (primeira vez)
git config --global user.name "rsetbrasil"
git config --global user.email "rsetbrasil@gmail.com"

# Publicar no GitHub
git add .
git commit -m "Initial commit: Sistema ADC Móveis e Eletros completo"
git remote remove origin
git remote add origin https://github.com/rsetbrasil/adc-moveis-eletro.git
git push -u origin main
```

## 🔑 Lembre-se da Autenticação

Quando pedir **senha**, use o **Personal Access Token**:
- Crie em: https://github.com/settings/tokens
- Marque: ✅ `repo`
- Cole o token quando pedir senha

---

## 📋 Checklist

- [ ] Fechar TODAS as janelas do PowerShell
- [ ] Fechar VS Code
- [ ] Abrir NOVO PowerShell
- [ ] Testar: `git --version`
- [ ] Se funcionar, executar os comandos acima
- [ ] Usar Personal Access Token como senha

**IMPORTANTE**: O problema é que você precisa REINICIAR o PowerShell! 🔄
