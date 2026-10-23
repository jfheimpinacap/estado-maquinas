# Flujo de desarrollo local

## Entorno y coordinación

Los prompts numerados se entregan a Codex local en la extensión de VS Code, sobre el clon Windows `C:\Users\Franz\Desktop\App web Estado de maquinas`, del repositorio `jfheimpinacap/estado-maquinas`. La extensión permite elegir trabajo local o Cloud ([documentación oficial](https://learn.chatgpt.com/docs/codex/ide)); para este flujo se usa “Work locally”. No se trabaja simultáneamente en Cloud y local sobre cambios pendientes de la misma tarea.

Abrir VS Code no demuestra dónde se ejecutan los comandos. Antes de editar o validar se comprueban con herramientas el sistema operativo del ejecutor, la ubicación resuelta y la raíz Git. Si el ejecutor está en Cloud, WSL, SSH, un contenedor o un checkout distinto del clon Windows exigido, se detiene sin editar ni validar y se informa el bloqueo. No se intenta compensar ese entorno copiando rutas Windows en comandos de otro sistema.

## Secuencia de una tarea

```text
ChatGPT analiza y redacta Prompt NNN
→ usuario lo entrega a Codex local en VS Code
→ Codex hace precheck, sincroniza main de forma segura y crea una rama propia
→ implementa solo el alcance y ejecuta las verificaciones pertinentes
→ Codex inspecciona internamente diff completo, índice y archivos nuevos, y contrasta el alcance
→ entrega un Summary autosuficiente, con revisión visual efectuada o pendiente
→ usuario copia únicamente el Summary al coordinador para revisar el informe
→ correctivos antes del merge: NNNA / NNNB / NNNC, misma tarea y rama
→ tras aprobación, un prompt separado autoriza commit, push y apertura de PR por Codex
→ usuario controla el merge y los despliegues
→ sincronización segura de main y verificación de integración
→ siguiente tarea con el siguiente entero entregado por el usuario
```

Codex no inventa ni avanza correlativos, no adelanta fases y no amplía el alcance. Una corrección del Prompt 026 antes del merge sigue siendo 026A, luego 026B, en la misma rama. Después del merge, un defecto nuevo recibe el siguiente entero disponible, no otro sufijo de la tarea integrada. Una instrucción posterior explícita del usuario puede cambiar una regla operativa para esa tarea concreta; no constituye permiso permanente.

## Precheck y protección del trabajo

Antes de tocar archivos se registra:

1. Sistema operativo y evidencia de ejecución local; ubicación resuelta y `git rev-parse --show-toplevel`, que deben corresponder al clon Windows indicado.
2. Rama activa (`git branch --show-current`), `HEAD` (`git rev-parse HEAD`) y base prevista de la tarea.
3. Árbol e índice: `git status --short --branch`, `git status --porcelain=v1 --untracked-files=all`, `git diff --name-status` y `git diff --cached --name-status`. Se incluyen archivos sin seguimiento.
4. Identidad de `origin`, tanto fetch como push, sin mostrar credenciales. Se captura la configuración y se informa solo host y propietario/repositorio; no se vuelcan URLs con tokens, configuración completa ni archivos de credenciales.
5. Instrucciones `AGENTS.md` y `AGENTS.override.md` aplicables, incluidas las de directorios superiores y las del área que se editará.
6. Estructura e historial (`git log`), integración de la tarea anterior y relación con `origin/main`. Si el hash avanzó por un merge legítimo, se comprueba ascendencia con `git merge-base --is-ancestor` o contenido integrado; no se exige igualdad literal con un hash histórico.

Que falte `origin` no demuestra por sí solo que el checkout sea incorrecto: estructura, historial y contenido aportan evidencia local. Sin embargo, no se puede declarar sincronización con GitHub sin verificarla. No se agrega ni cambia un remoto para resolverlo por iniciativa propia; se informa la limitación y se detiene si no se puede establecer la base segura requerida.

Los cambios preexistentes se conservan. Ante cambios ajenos, una rama de otra tarea, divergencia, commits locales inesperados o dudas sobre la base, se informa y se detiene antes de editar. No se usan `reset --hard`, `clean`, stash automático ni reescritura de historial como solución rutinaria. Un correctivo de la misma tarea puede continuar sobre sus cambios relacionados, después de revisarlos y registrarlos.

### Base y rama de trabajo

Para una tarea nueva, con árbol e índice limpios, se confirma `main` y el remoto esperado, se actualiza `origin/main` mediante `git fetch origin main` y se compara `main...origin/main` con `git rev-list --left-right --count`. Si coinciden, no hace falta integrar nada. Si `main` está únicamente atrasado, se permite `git merge --ff-only origin/main` sobre `main`. Si está adelantado de forma inesperada o diverge, se detiene; no se fuerza la sincronización.

Desde ese `main` sincronizado se crea y activa una rama local propia mediante `git switch -c`, por ejemplo `codex/026-workflow-local-vscode` para el Prompt 026. Se vuelven a verificar rama, `HEAD` y estado. No se editan archivos directamente sobre `main`. Las correcciones A/B/C continúan en la rama de la tarea y no recrean la base sobre cambios pendientes.

## Límites operativos

- No acceder a producción, usar secretos reales ni operar sobre datos reales. No mostrar tokens, contraseñas o contenidos de `.env` reales en comandos, logs, capturas, diffs o resúmenes.
- `migrate`, un `makemigrations` que escriba archivos, backfill, rollback, cargas, limpiezas o preparación de datos requieren alcance y autorización específicos. No se ejecutan por rutina ni como preparación implícita de una validación.
- No instalar ni restaurar paquetes, alterar dependencias o versiones, instalar herramientas globales ni modificar configuración personal como remedio improvisado. Si falta un requisito, informar el bloqueo y justificar la autorización específica necesaria, sin cambiar el entorno por iniciativa propia.
- No usar `start.py` como diagnóstico, arranque o prueba habitual: automatiza instalaciones, migraciones, servidores y navegador. Solo una tarea dedicada específicamente a revisar ese script puede autorizar su ejecución.
- La implementación ordinaria no crea commit, push ni PR. La publicación requiere el prompt separado descrito más adelante. El usuario controla merge y despliegues.

## Validación antes de entregar

En tareas locales se ejecutan las pruebas, checks y builds pertinentes al alcance **antes del Summary y de pedir aprobación para publicar**. La prohibición general de ejecutar tests en Codex del flujo anterior queda reemplazada por esta regla local; no se pospone por defecto la validación al PR o al merge. Se respetan siempre las restricciones del prompt vigente.

Se eligen verificaciones según lo modificado: tests dirigidos para el comportamiento afectado, suite backend cuando corresponda, checks Django y comprobación seca de migraciones como verificaciones distintas, y frontend cuando se vea afectado. No se amplía una tarea documental ejecutando la aplicación o suites sin necesidad: para estos textos corresponden relectura, coherencia, revisión del diff, `git diff --check` y estado Git.

Cada resultado indica el comando exacto, entorno, resultado y código de salida de la ejecución actual. Se diferencian pruebas escritas, pruebas automatizadas ejecutadas, pendientes y omisiones con su motivo. Los resultados históricos no se atribuyen a la tarea actual; un commit o un Summary no acreditan pruebas aprobadas.

La revisión visual se informa aparte: qué pantalla o artefacto se observó, cómo y con qué resultado, o qué quedó pendiente y por qué. Un build o una suite verde no sustituyen la revisión del comportamiento en navegador. Si se requieren servidores locales, se identifican los procesos propios y se respetan los que el usuario ya tenga abiertos, sin recurrir a `start.py`.

## PowerShell y comandos reales del proyecto

Todo bloque PowerShell comienza con la ubicación absoluta siguiente; `-LiteralPath` y las comillas contemplan los espacios. Después de cada comando nativo se comprueba `$LASTEXITCODE` y se detiene ante un error. Los fallos de cmdlets también deben detener el bloque; los ejemplos usan `-ErrorAction Stop` al cambiar ubicación. No se depende de que `python` esté en `PATH` ni se usan ejemplos `python -c` con comillas anidadas.

La estructura revisada para este flujo es:

- Django: `backend\manage.py`, `backend\estado_maquinas\settings.py` e intérprete `backend\.venv\Scripts\python.exe`. La existencia de otro directorio `backend\venv` no cambia el intérprete elegido.
- Configuración de ejemplo: `backend\.env.example`. `settings.py` carga `backend/.env` sin sobrescribir variables ya presentes en el proceso, exige `DJANGO_SECRET_KEY` y `DJANGO_ALLOWED_HOSTS` y configura SQLite en `backend/db.sqlite3`. SQL Server no está activo en esa configuración. No se abre ni se usa esa base de desarrollo para validar con datos reales.
- Frontend React/Vite: `frontend\package.json`. Los scripts actuales son `dev`, `build`, `lint` y `preview`; no hay un script `test` declarado. Se vuelve a consultar el manifiesto en cada tarea que requiera frontend.

### Backend: comprobaciones separadas

La receta siguiente ejecuta **una** comprobación. Antes de usarla se elige `$djangoArgs` según el alcance, con estas alternativas:

| Verificación | Valor de `$djangoArgs` | Qué comprueba |
| --- | --- | --- |
| Tests dirigidos | `@('test', 'api.tests.test_prompt_025_arriendo_item_shadow_read')` | Ejemplo de módulo real; elegir los módulos afectados por la tarea. También existen los de regresión 017 y 018. |
| Suite backend | `@('test')` | Suite completa del backend; no equivale solo a tests dirigidos. |
| Check Django | `@('check')` | Configuración y checks del sistema; no sustituye los tests. |
| Migraciones, comprobación seca | `@('makemigrations', '--check', '--dry-run')` | Detecta cambios de modelo sin migración, sin generar archivos ni aplicar migraciones. |

```powershell
Set-Location -LiteralPath 'C:\Users\Franz\Desktop\App web Estado de maquinas' -ErrorAction Stop
$repoRoot = (Get-Location).Path
$djangoPython = Join-Path $repoRoot 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $djangoPython -PathType Leaf)) {
    throw "No existe el intérprete esperado: $djangoPython. No instalar automáticamente."
}

# Sustituir esta selección por UNA alternativa de la tabla, según la tarea.
$djangoArgs = @('check')
$validationEnvNames = @(
    'DJANGO_SETTINGS_MODULE',
    'DJANGO_SECRET_KEY',
    'DJANGO_DEBUG',
    'DJANGO_ALLOWED_HOSTS',
    'CORS_ALLOWED_ORIGINS',
    'CSRF_TRUSTED_ORIGINS'
)
$previousValidationEnv = @{}
foreach ($validationEnvName in $validationEnvNames) {
    $previousValidationEnv[$validationEnvName] = [Environment]::GetEnvironmentVariable($validationEnvName, 'Process')
}

try {
    $env:DJANGO_SETTINGS_MODULE = 'estado_maquinas.settings'
    $env:DJANGO_SECRET_KEY = 'local-validation-' + [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
    $env:DJANGO_DEBUG = 'True'
    $env:DJANGO_ALLOWED_HOSTS = 'localhost,127.0.0.1,testserver'
    $env:CORS_ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
    $env:CSRF_TRUSTED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'

    Push-Location -LiteralPath (Join-Path $repoRoot 'backend') -ErrorAction Stop
    try {
        & $djangoPython manage.py @djangoArgs
        $djangoExitCode = $LASTEXITCODE
        if ($djangoExitCode -ne 0) { throw "Falló manage.py $($djangoArgs -join ' ') (salida $djangoExitCode)." }
        Write-Output "manage.py $($djangoArgs -join ' '): salida $djangoExitCode."
    }
    finally { Pop-Location -ErrorAction Stop }
}
finally {
    foreach ($validationEnvName in $validationEnvNames) {
        [Environment]::SetEnvironmentVariable($validationEnvName, $previousValidationEnv[$validationEnvName], 'Process')
    }
}
```

Las variables de validación son locales y sintéticas; no se copian de un `.env` real ni se persisten en archivos o configuración del usuario. Se restauran los valores previos del proceso en `finally`, incluso ante un fallo. La receta se repite solo para las comprobaciones seleccionadas, registrando la invocación y los argumentos efectivamente usados.

Los tests utilizan la base de pruebas aislada administrada por Django y sus datos sintéticos; no se ejecutan scripts de preparación contra `backend/db.sqlite3`. Las migraciones que Django pueda aplicar dentro de esa base de pruebas forman parte del runner, no autorizan `manage.py migrate` sobre la base de desarrollo. `manage.py makemigrations --check --dry-run` es solo una comprobación seca, sin permiso para generar archivos o aplicar migraciones. Se revisan la configuración efectiva y el alcance antes de ejecutar; no se cambian settings para hacer pasar el check.

### Frontend

Cuando el alcance requiera frontend, primero se consulta el manifiesto real. El siguiente bloque solo lo lee:

```powershell
Set-Location -LiteralPath 'C:\Users\Franz\Desktop\App web Estado de maquinas' -ErrorAction Stop
$frontendManifest = Get-Content -LiteralPath '.\frontend\package.json' -Raw -Encoding UTF8 -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
$frontendManifest.scripts
```

Una vez elegidos los scripts pertinentes, el ejemplo siguiente ejecuta lint y build con las dependencias locales ya disponibles. No instala paquetes. Si solo corresponde uno, se conserva únicamente su invocación y comprobación de salida. No se inventa `npm test` ni se ejecutan `dev` o `preview` como si fueran tests automatizados.

```powershell
Set-Location -LiteralPath 'C:\Users\Franz\Desktop\App web Estado de maquinas' -ErrorAction Stop
Push-Location -LiteralPath '.\frontend' -ErrorAction Stop
try {
    npm.cmd run lint
    if ($LASTEXITCODE -ne 0) { throw "Falló lint (salida $LASTEXITCODE)." }
    npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw "Falló build (salida $LASTEXITCODE)." }
}
finally { Pop-Location -ErrorAction Stop }
```

## Revisión, publicación e integración

Antes de entregar, Codex inspecciona internamente el diff completo del árbol, los cambios preparados en el índice y el contenido de todos los archivos nuevos. Los archivos sin seguimiento no aparecen necesariamente en `git diff`: se enumeran y se lee su contenido. Codex contrasta el conjunto con el alcance autorizado, comprueba la lista completa de archivos afectados y registra desviaciones, cambios inesperados y trabajo preexistente preservado. No se ocultan cambios ajenos mediante un diff parcial ni se exponen secretos.

El usuario entrega únicamente un **Summary autosuficiente** al coordinador. No se exige trasladar aparte el diff, archivos de parche ni salidas adicionales de terminal o logs como requisito habitual de revisión. Tampoco se pega el diff completo dentro del Summary: se explican todos los cambios significativos y la evidencia necesaria con la estructura indicada más adelante. Si falta evidencia, se solicita una aclaración concreta o una ampliación del Summary.

El Summary distingue la revisión local realizada por Codex sobre archivos, cambios y verificaciones de la revisión de ese informe realizada por el coordinador. Se informa el estado real de ambas; no se declara aprobada la revisión del coordinador antes de que ocurra.

La implementación ordinaria deja los cambios locales sin commit. Tras revisar y aprobar el Summary, **un prompt separado de publicación** autoriza a Codex a hacer commit, push y abrir el PR de la rama revisada. El usuario no necesita hacer el commit manualmente. Ese permiso no autoriza merge, automerge ni despliegues; el usuario conserva su control.

Después del merge, con árbol e índice limpios y dentro del paso de sincronización acordado, se actualiza `origin/main`, se sincroniza `main` mediante avance rápido seguro cuando corresponda y se verifica que el merge o el contenido aprobado esté integrado. Se registran rama, `HEAD` y estado finales. Si hay cambios pendientes o divergencia, se preservan y se informa antes de continuar. Este avance rápido local no es autorización para integrar un PR en GitHub.

No se repite una suite completa que ya pasó sobre el mismo contenido y entorno sin causa concreta. Cambios posteriores, diferencias de entorno o una verificación pendiente pueden justificar otra ejecución; se informa el motivo. La sincronización no convierte resultados históricos en pruebas ejecutadas durante la tarea actual.

### Transferencia excepcional desde Cloud

“Apply changes and continue locally?” se reserva para trasladar cambios preparados en Cloud hacia una rama local revisada. Antes de aplicar se comprueban el entorno Windows, raíz, rama, `HEAD`, árbol e índice, se examina el diff Cloud y su compatibilidad con la base local y se protege el trabajo preexistente. No se mantiene otra ejecución Cloud modificando la misma tarea mientras se continúa localmente.

Se aplica una sola vez. Después se verifican archivos y diff resultantes, rama, `HEAD` y estado, y se realizan las validaciones locales pertinentes antes del Summary. No se presupone que se transfieran los commits de Cloud: se comprueba el contenido y el historial realmente presentes. Apply no autoriza commit, push, PR, merge ni despliegue. No se usa para cambios ya hechos en VS Code local ni para cambios recibidos mediante merge y sync; tampoco se repite una transferencia ya aplicada.

## Contexto arquitectónico

El repositorio ya contiene el modelo y herramientas controladas de `ArriendoItem`, pero `ArriendoItem` todavía no es la fuente operativa autoritativa. Primero se termina y estabiliza Django; la futura edición .NET comienza después, con alcance propio y un futuro frontend compartido. Esta secuencia no autoriza funcionalidades multi-máquina ni nuevas escrituras hacia `ArriendoItem` en una tarea documental.

## Summary de Codex

La entrega única que el usuario copia para revisión comienza con `# Summary` y debe permitir evaluar todo el alcance significativo sin requerir anexos. Incluye estas secciones obligatorias:

1. **Identificación y precheck:** prompt y correctivo, si corresponde; sistema y entorno verificados, raíz, rama y `HEAD` de base, estado inicial relevante del árbol, índice y archivos nuevos, remoto sin credenciales, instrucciones aplicables e integración previa. Indicar sincronización efectuada o sus limitaciones; en un correctivo, registrar que se continúa la rama existente sin sincronizar `main` sobre cambios pendientes.
2. **Archivos:** lista completa de archivos creados, modificados o eliminados, indicando la operación de cada uno.
3. **Cambios por archivo y finalidad:** explicar todos los cambios relevantes de cada archivo y para qué se hicieron; evitar fórmulas vagas como “ajustes varios”. Cuando cambien reglas funcionales u operativas, describir el comportamiento anterior y el nuevo. Cuando corresponda, concretar los contratos afectados: endpoints, campos, validaciones, permisos, flags, configuración, modelos o migraciones. En un correctivo, distinguir lo que añadió de lo ya preparado en la tarea y resumir el resultado acumulado.
4. **Alcance y revisión local de Codex:** confirmar la inspección del diff completo, los cambios del índice y el contenido de archivos nuevos, y su contraste con el alcance autorizado. Informar toda desviación, cambio inesperado o trabajo preexistente preservado; si no los hubo, indicarlo.
5. **Pruebas escritas y verificaciones ejecutadas:** identificar las pruebas escritas, incluso si no se ejecutaron, y separar pruebas automatizadas de comprobaciones documentales. Registrar los comandos exactos de validación ejecutados, resultados, cantidades cuando apliquen y códigos de salida observados en esta ejecución. Los resultados anteriores se identifican expresamente como históricos, sin atribuirlos a la tarea actual.
6. **Verificaciones no ejecutadas o fallidas y motivo:** incluir tests, checks, builds u otras comprobaciones omitidas, pendientes o bloqueadas, con su causa concreta y el error relevante cuando exista, sin secretos. Si no aplican por ser documental, indicarlo sin sugerir que deban ejecutarse después del PR.
7. **Revisión visual:** qué se revisó visualmente, cómo y con qué resultado; qué falta y por qué. No declarar una revisión de navegador ni de un render si no ocurrió.
8. **Riesgos, limitaciones y decisiones pendientes:** supuestos, límites de la evidencia y cuestiones aún abiertas.
9. **Revisión del coordinador:** distinguir la revisión de este informe de la revisión local de Codex descrita antes e indicar si sigue pendiente. No atribuir al coordinador inspecciones locales que no realizó ni aprobaciones que no emitió.
10. **Estado final:** rama, `HEAD`, árbol, índice y archivos nuevos al terminar; situación de commit, push y PR y confirmación de si sigue sin publicar. Incluir enlaces de publicación solo cuando existan y estén autorizados.

Cubrir todo el alcance significativo no significa describir cada línea ni reproducir código completo. No se adjunta ni se pega el diff completo dentro del Summary, ni se exige copiar parches o logs. Ante evidencia insuficiente se pide una aclaración concreta o una ampliación del Summary.

### Herramientas internas de inspección

El bloque siguiente es una herramienta interna de Codex para revisar una entrega local sin commit; no es una tarea manual obligatoria para el usuario ni una salida que deba copiar como anexo. Muestra diff de trabajo, índice y lista de archivos sin seguimiento. Esta lista no sustituye leer el contenido de cada archivo nuevo; Codex también lo inspecciona y lo contrasta con el alcance. Antes de mostrar contenido se verifica que no incluya secretos.

```powershell
Set-Location -LiteralPath 'C:\Users\Franz\Desktop\App web Estado de maquinas' -ErrorAction Stop
git diff --check
if ($LASTEXITCODE -ne 0) { throw "Falló diff --check (salida $LASTEXITCODE)." }
git diff --cached --check
if ($LASTEXITCODE -ne 0) { throw "Falló diff --cached --check (salida $LASTEXITCODE)." }
git diff --stat
if ($LASTEXITCODE -ne 0) { throw "Falló diff --stat (salida $LASTEXITCODE)." }
git diff --cached --stat
if ($LASTEXITCODE -ne 0) { throw "Falló diff --cached --stat (salida $LASTEXITCODE)." }
git --no-pager diff
if ($LASTEXITCODE -ne 0) { throw "Falló la lectura del diff (salida $LASTEXITCODE)." }
git --no-pager diff --cached
if ($LASTEXITCODE -ne 0) { throw "Falló la lectura del diff del índice (salida $LASTEXITCODE)." }
git ls-files --others --exclude-standard
if ($LASTEXITCODE -ne 0) { throw "Falló la lista de archivos nuevos (salida $LASTEXITCODE)." }
git status --short --branch
if ($LASTEXITCODE -ne 0) { throw "Falló status (salida $LASTEXITCODE)." }
```
