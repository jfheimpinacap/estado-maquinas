# Instrucciones de trabajo

- Limítate al alcance del prompt vigente. No adelantes fases ni modifiques archivos ajenos a la tarea. Si una instrucción futura del usuario cambia expresamente una regla operativa de este documento, esa instrucción prevalece para esa tarea.
- Antes de editar, confirma raíz, rama, `HEAD`, estado del árbol e instrucciones `AGENTS.md` aplicables. Comprueba además la estructura y el historial: que falte `origin` no demuestra por sí solo que el checkout sea incorrecto.
- El usuario entrega cada prompt numerado. Codex no inventa ni avanza correlativos. Una corrección anterior al PR conserva la tarea con sufijos `A`, `B`, `C`; un defecto nuevo descubierto después de cerrar el merge usa el siguiente entero disponible.
- No hagas push, crees un PR, hagas merge ni despliegues salvo instrucción explícita.
- No accedas a producción, uses secretos reales ni ejecutes operaciones sobre datos reales.
- No ejecutes restore, instalaciones, tests ni builds en Codex salvo autorización explícita del prompt. Distingue siempre entre pruebas escritas, ejecutadas y pendientes.
- No uses `start.py` como diagnóstico, arranque o prueba habitual. Solo una tarea dedicada específicamente a ese script puede autorizar su ejecución.
- No ejecutes automáticamente `migrate`, un `makemigrations` que escriba archivos, backfill, rollback, cargas de datos fake, limpieza ni scripts de preparación de datos.
- Termina la entrega con `# Summary` y secciones de precheck, archivos, cambios, verificaciones ejecutadas, verificaciones pendientes, riesgos y estado final.

Consulta [`docs/DEVELOPMENT_WORKFLOW.md`](docs/DEVELOPMENT_WORKFLOW.md) para el flujo detallado y los comandos de validación local.
