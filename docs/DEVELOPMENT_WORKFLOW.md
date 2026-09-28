# Workflow de desarrollo

## Flujo acordado

```text
ChatGPT analiza y redacta Prompt NNN
→ usuario lo copia en Codex
→ Codex realiza solo esa tarea y entrega Summary
→ ChatGPT revisa el Summary
→ si hay un problema antes del PR: NNNA / NNNB
→ si se aprueba: usuario hace PR, merge y sync local
→ pruebas locales cuando corresponda
→ siguiente correlativo
```

El prompt numerado define el alcance completo de una ejecución. Codex no inventa el próximo número, no adelanta una fase y no incorpora trabajo funcional que el prompt no haya pedido. El usuario conserva el control del PR, el merge y la sincronización de su clon local.

Si la revisión previa al PR detecta un error en el Prompt 020, su corrección sigue perteneciendo a la misma tarea y se identifica como 020A; otra iteración sería 020B. En cambio, si el PR de 020 ya fue cerrado mediante merge y luego aparece un defecto nuevo, el trabajo recibe el siguiente número entero disponible. Un commit creado o un Summary entregado solo acredita que se produjo una revisión: no equivale a pruebas ejecutadas ni aprobadas.

## Precheck y límites operativos

Antes de tocar archivos se registran la raíz del checkout, la rama, el `HEAD`, `git status --short` y las instrucciones aplicables. También se comprueban la estructura esperada y el historial o, si el hash cambió por un merge, evidencia verificable del resultado requerido. Un checkout sin remoto configurado tiene trazabilidad remota limitada, pero la ausencia de `origin` no lo invalida automáticamente cuando su base, estructura e integración se pueden comprobar localmente. No se agrega un remoto para suplir esa ausencia.

Codex trabaja únicamente dentro del repositorio y del alcance indicados. Salvo autorización explícita del prompt, no:

- hace push, abre PR, integra merges ni despliega;
- accede a producción, secretos verdaderos o datos reales;
- restaura entornos, instala dependencias, ejecuta tests o genera builds;
- ejecuta migraciones, genera archivos de migración, hace backfill o rollback, carga o limpia datos fake ni prepara datos;
- usa `start.py`: el script automatiza instalaciones, migraciones, servidores y navegador, por lo que solo una tarea dedicada específicamente a él puede autorizar su ejecución.

Una instrucción futura explícita puede cambiar una de estas reglas para esa tarea concreta. La autorización debe interpretarse de forma acotada, no como permiso permanente.

## Summary de Codex

La entrega comienza con `# Summary` y separa como mínimo:

1. **Precheck:** raíz, rama, `HEAD`, limpieza inicial, instrucciones aplicables, integración base y limitaciones de trazabilidad.
2. **Archivos:** creados, modificados o eliminados.
3. **Cambios:** qué se hizo y qué quedó deliberadamente fuera.
4. **Verificaciones ejecutadas:** comando exacto y resultado observado durante la tarea actual.
5. **Verificaciones pendientes:** tests, builds o comprobaciones no ejecutados, junto con el motivo; por ejemplo, “No ejecutado: el prompt prohíbe tests en Codex; queda pendiente la validación local en Windows”.
6. **Riesgos y decisiones abiertas:** contradicciones, supuestos y seguimiento necesario.
7. **Estado final:** estado del árbol y commit, si existe.

No se presentan pruebas históricas como si se hubieran ejecutado en la tarea actual. Deben distinguirse claramente las pruebas escritas, las ejecutadas y las pendientes. Del mismo modo, ni el commit ni el Summary sustituyen la revisión o la validación local.

## Separación entre Codex y Windows

Codex prepara el cambio y efectúa solo las verificaciones autorizadas. Después de la revisión del Summary, el usuario decide si crea el PR, lo integra, sincroniza su clon y ejecuta la validación en Windows cuando corresponda. Los resultados del 28 de septiembre de 2026 —29 tests dirigidos, 92 tests del backend, `manage.py check` y la comprobación seca de migraciones— pertenecen a la validación local posterior del Prompt 019A; no son ejecuciones del Prompt 020.

El repositorio ya contiene el modelo y las herramientas controladas relacionadas con `ArriendoItem`, pero `ArriendoItem` todavía no es la fuente operativa autoritativa de la aplicación. Primero se termina y estabiliza Django; la futura edición .NET comienza después y requiere su propio alcance. Esta aclaración registra el orden arquitectónico, no agrega requisitos funcionales ni autoriza escritura nueva hacia `ArriendoItem`.

## PowerShell para validación local

### Preparación segura del proceso

La siguiente receta reproduce la forma comprobada el 28 de septiembre de 2026. El usuario debe asignar `$repo` a la ruta de **su propio clon**. `Set-Location -LiteralPath` admite rutas con espacios y se usa explícitamente `backend\.venv\Scripts\python.exe`, sin presuponer un comando `python` en `PATH`.

El bloque guarda las variables del proceso, configura valores locales sintéticos y las restaura incluso si una comprobación falla. Django exige `DJANGO_SECRET_KEY` y `DJANGO_ALLOWED_HOSTS`; la validación también utilizó orígenes locales para CORS y CSRF. No copies secretos de un `.env` real.

```powershell
$repo = 'C:\ruta\a\su\clon\estado-maquinas'
Set-Location -LiteralPath $repo

$python = Join-Path $repo 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    throw "No existe el intérprete esperado: $python"
}

$names = @(
    'DJANGO_SECRET_KEY',
    'DJANGO_DEBUG',
    'DJANGO_ALLOWED_HOSTS',
    'CORS_ALLOWED_ORIGINS',
    'CSRF_TRUSTED_ORIGINS'
)
$previous = @{}
foreach ($name in $names) {
    $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    $env:DJANGO_SECRET_KEY = 'local-validation-' + [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    $env:DJANGO_DEBUG = 'True'
    $env:DJANGO_ALLOWED_HOSTS = 'localhost,127.0.0.1,testserver'
    $env:CORS_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
    $env:CSRF_TRUSTED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'

    & $python -m django --version
    if ($LASTEXITCODE -ne 0) { throw "Falló la verificación de Django ($LASTEXITCODE)." }

    # Ejecute aquí, uno por uno, los bloques de validación de la sección siguiente.
}
finally {
    foreach ($name in $names) {
        [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process')
    }
}
```

Para que la restauración ocurra al final de toda la sesión, los bloques siguientes se colocan dentro del `try`, en sustitución del comentario. Se evitan ejemplos `python -c` con comillas anidadas porque el PowerShell usado durante la validación alteró el código enviado al intérprete.

### Comandos de backend separados

Tests dirigidos de las regresiones estrictas de los Prompts 017 y 018 (29 tests en la ejecución comprobada):

```powershell
Push-Location -LiteralPath (Join-Path $repo 'backend')
try {
    & $python manage.py test api.tests.test_prompt_017_arriendo_item_backfill api.tests.test_prompt_018_multi_machine_case_classification
    if ($LASTEXITCODE -ne 0) { throw "Fallaron los tests dirigidos ($LASTEXITCODE)." }
}
finally { Pop-Location }
```

Suite completa del backend (92 tests en la ejecución comprobada):

```powershell
Push-Location -LiteralPath (Join-Path $repo 'backend')
try {
    & $python manage.py test
    if ($LASTEXITCODE -ne 0) { throw "Falló la suite backend ($LASTEXITCODE)." }
}
finally { Pop-Location }
```

Comprobación de configuración de Django:

```powershell
Push-Location -LiteralPath (Join-Path $repo 'backend')
try {
    & $python manage.py check
    if ($LASTEXITCODE -ne 0) { throw "Falló manage.py check ($LASTEXITCODE)." }
}
finally { Pop-Location }
```

Comprobación de cambios de modelo sin migración:

```powershell
Push-Location -LiteralPath (Join-Path $repo 'backend')
try {
    & $python manage.py makemigrations --check --dry-run
    if ($LASTEXITCODE -ne 0) { throw "Se detectaron migraciones pendientes o un error ($LASTEXITCODE)." }
}
finally { Pop-Location }
```

`makemigrations --check --dry-run` comprueba si los modelos requerirían migraciones, pero no crea archivos ni aplica migraciones. Los comandos de tests usan la base de datos de pruebas administrada por Django; estos bloques no ejecutan backfill, rollback ni ninguna operación equivalente contra la base existente.

### Frontend

El frontend se valida únicamente cuando el cambio lo requiere. Primero se revisa `frontend/package.json` y luego, desde `frontend`, se elige uno de los scripts que realmente estén declarados allí. No se presupone ni se inventa un comando. La instalación de dependencias y la ejecución de lint o build siguen necesitando la autorización y el contexto de la tarea correspondiente.
