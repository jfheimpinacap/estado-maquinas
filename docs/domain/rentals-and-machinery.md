# Dominio de arriendos y maquinaria

## 1. Propósito, alcance y lectura del documento

Este documento fija una baseline de dominio para evolucionar el sistema hacia arriendos con varias máquinas. Es neutral respecto de Django y de la futura edición ASP.NET Core: describe responsabilidades, reglas e invariantes, no clases o tablas obligatorias para una tecnología. Complementa el diseño incremental de [`multi-machine-design.md`](../architecture/multi-machine-design.md), que conserva el orden de migración y compatibilidad.

Se distinguen cuatro niveles para no confundir evidencia con intención:

* **Implementado:** comportamiento verificable hoy en el repositorio.
* **Acordado:** regla de negocio o decisión arquitectónica que debe preservar la evolución.
* **Objetivo propuesto:** forma recomendada para las próximas fases, todavía no operativa.
* **Abierto:** decisión que requiere una regla adicional antes de implementarse.

Esta tarea es exclusivamente documental. No implementa escrituras compatibles, lecturas por ítem, estados, períodos, movimientos, cambios documentales ni cambios de interfaz.

## 2. Estado implementado y verificable

### 2.1 Entidades y relaciones persistidas

* `Maquinaria` representa el activo físico. Su PK es hoy la identidad relacional estable; `serie` es opcional pero única cuando existe. El campo `estado` solo declara `Disponible` y `Para venta`, aunque otras rutas escriben `Arrendada`, por lo que no es un vocabulario operativo completo ([`backend/api/models.py`, líneas 10-49](../../backend/api/models.py#L10-L49)).
* `Arriendo` sigue siendo una cabecera mono-máquina en su contrato operativo: contiene FKs opcionales a una `Maquinaria`, un `Cliente` y una `Obra`, más fechas, período, tarifa y un `estado` de texto libre. No tiene una restricción que evite dos cabeceras activas para la misma máquina ([`backend/api/models.py`, líneas 90-106](../../backend/api/models.py#L90-L106)).
* `ArriendoItem` ya existe como relación persistente no nula y protegida entre una cabecera y una máquina, con índice por ambas FKs, pero sin unicidad, estado, fechas ni reglas operativas propias ([`backend/api/models.py`, líneas 109-128](../../backend/api/models.py#L109-L128)). Que exista la tabla no la convierte en fuente autoritativa.
* `OrdenTrabajo` (OT) puede apuntar opcionalmente a un `Arriendo` y a una sola `Maquinaria`. Sus tipos actuales son `ALTA`, `PROL`, `TRAS`, `RETI` y `SERV`; además mantiene referencias opcionales a una factura y una guía ([`backend/api/models.py`, líneas 207-279](../../backend/api/models.py#L207-L279)). Su `detalle_lineas` es JSON y permite representar varias líneas, pero no es una relación normalizada ([`backend/api/models.py`, líneas 282-318](../../backend/api/models.py#L282-L318)).
* `Documento` pertenece obligatoriamente a una cabecera `Arriendo`, no a un `ArriendoItem`. Puede relacionarse con otro documento, marcar una guía como retiro y guardar obra de origen/destino; no hay línea documental por máquina ni unicidad de folio ([`backend/api/models.py`, líneas 157-198](../../backend/api/models.py#L157-L198)). Estos modelos no prueban integración con emisión tributaria DTE real.

El API publica recursos `maquinarias`, `arriendos`, `documentos` y `ordenes`, entre otros ([`backend/api/urls.py`, líneas 12-20](../../backend/api/urls.py#L12-L20)). Sin embargo, `ArriendoSerializer` expone la FK singular `maquinaria` y no expone `items`; `OrdenTrabajoSerializer` expone tanto la maquinaria singular como `detalle_lineas` ([`backend/api/serializers.py`, líneas 185-200](../../backend/api/serializers.py#L185-L200), [`backend/api/serializers.py`, líneas 270-309](../../backend/api/serializers.py#L270-L309)).

### 2.2 Dependencias legacy verificadas

La operación ordinaria todavía depende de `Arriendo.maquinaria`:

1. El historial de una máquina filtra cabeceras por esa FK y toma sus documentos de cabecera; no consulta `ArriendoItem` ([`backend/api/views.py`, líneas 245-276](../../backend/api/views.py#L245-L276)).
2. La ubicación visible de una máquina se infiere del arriendo activo más reciente de la relación inversa legacy, o se muestra como bodega ([`backend/api/serializers.py`, líneas 110-115](../../backend/api/serializers.py#L110-L115)).
3. `estado-arriendos` incluye solo cabeceras activas con FK singular no nula y devuelve una fila cuya serie/marca/modelo provienen de esa máquina ([`backend/api/views.py`, líneas 974-991](../../backend/api/views.py#L974-L991), [`backend/api/views.py`, líneas 1048-1073](../../backend/api/views.py#L1048-L1073)).
4. `estado-bodega` excluye máquinas mediante la existencia de un arriendo activo cuya FK singular coincida; su historial documental también navega esa relación ([`backend/api/views.py`, líneas 1077-1085](../../backend/api/views.py#L1077-L1085), [`backend/api/views.py`, líneas 1103-1125](../../backend/api/views.py#L1103-L1125)).
5. Un retiro emitido termina toda la cabecera y libera solamente `arr.maquinaria`; no puede expresar un retiro parcial seguro ([`backend/api/views.py`, líneas 930-959](../../backend/api/views.py#L930-L959)).

`detalle_lineas` cubre una necesidad distinta, también legacy. Al crear una OT, el servidor recibe `lineas`, omite las que no tienen serie, busca cada máquina por texto de serie y elige como `maquinaria_principal` la primera coincidencia (o previamente la FK del arriendo). Persiste serie, período, fechas e importes, pero no `maquinaria_id` ni `arriendo_item_id`; una serie no encontrada puede quedar como texto en el JSON ([`backend/api/views.py`, líneas 492-529](../../backend/api/views.py#L492-L529), [`backend/api/views.py`, líneas 575-631](../../backend/api/views.py#L575-L631)). El frontend confirma este contrato: envía líneas identificadas por `serie`, no por PK ([`frontend/src/components/CrearOT.jsx`, líneas 795-830](../../frontend/src/components/CrearOT.jsx#L795-L830)).

Cuando `ALTA` o `PROL` no recibe `arriendo_id`, la creación toma fechas, período y tarifa de la primera línea, crea una cabecera con la maquinaria principal y después crea la OT; esas dos escrituras no están envueltas juntas en una transacción ([`backend/api/views.py`, líneas 663-707](../../backend/api/views.py#L663-L707)). Al emitir una guía de `ALTA`, `PROL` o `TRAS`, una OT sin cabecera puede provocar la creación automática de una cabecera a partir de la FK singular o de la primera serie resoluble ([`backend/api/views.py`, líneas 140-207](../../backend/api/views.py#L140-L207), [`backend/api/views.py`, líneas 882-896](../../backend/api/views.py#L882-L896)).

### 2.3 Papel actual de `ArriendoItem` y herramientas de transición

`ArriendoItem` funciona **en sombra**: el esquema y las herramientas controladas pueden poblarlo y clasificar divergencias, pero los serializers, vistas y frontend citados no lo usan para decidir la operación. El backfill solo acepta pares deterministas, comprueba que `schema_version` sea exactamente el entero `1` (rechaza booleanos y otras versiones) y diferencia planificación de modos explícitos de escritura/rollback ([`backend/api/management/commands/backfill_arriendo_items.py`, líneas 15-37](../../backend/api/management/commands/backfill_arriendo_items.py#L15-L37), [`backend/api/management/commands/backfill_arriendo_items.py`, líneas 46-83](../../backend/api/management/commands/backfill_arriendo_items.py#L46-L83), [`backend/api/management/commands/backfill_arriendo_items.py`, líneas 110-129](../../backend/api/management/commands/backfill_arriendo_items.py#L110-L129)). La clasificación aplica la misma exigencia estricta al reporte de preflight ([`backend/api/management/commands/classify_multi_machine_cases.py`, líneas 77-93](../../backend/api/management/commands/classify_multi_machine_cases.py#L77-L93)).

Por tanto, ni la presencia de un ítem ni el resultado de un backfill autorizan a ignorar la FK legacy todavía. A la inversa, las series adicionales en JSON son evidencia para revisar, no relaciones históricas demostradas.

## 3. Decisiones de negocio y arquitectura acordadas

### 3.1 Responsabilidades estables

* **`Maquinaria`:** identidad del activo físico a través del tiempo. Su disponibilidad, ubicación o participación vigente no deben confundirse con su identidad ni deducirse definitivamente de un texto de serie.
* **`Arriendo`:** cabecera comercial/contractual compartida: cliente, contexto común y agrupación de participaciones, OTs y documentos. Una cabecera no equivale a una máquina.
* **`ArriendoItem`:** participación individual de una `Maquinaria` en una cabecera. Será el punto de control por activo para vigencia operativa, retiro y futuras relaciones, sin afirmar aún dónde vivirán todos esos datos.
* **OT:** solicitud y snapshot de una operación. No reemplaza la identidad persistente del activo ni debe convertir texto ambiguo en una relación.
* **`Documento`:** constancia histórica con identidad y significado propios. Un documento de cabecera existente no debe reasignarse retroactivamente a un ítem sin evidencia.

### 3.2 Conceptos que deben permanecer separados

| Concepto | Significado | Representación fiable hoy |
|---|---|---|
| Estado comercial del arriendo | Situación contractual/comercial de la cabecera. | Solo existe `Arriendo.estado` como texto libre; no basta para todas las reglas por activo. |
| Estado operativo del ítem | Si una participación concreta está pendiente, entregada, retirada, etc. | **No existe** en `ArriendoItem`. |
| Disponibilidad | Si una máquina puede comprometerse a otra operación. | Se aproxima combinando `Maquinaria.estado` y cabeceras activas legacy; no es fiable para máquinas adicionales. |
| Ubicación física | Lugar en el que está realmente la máquina en un instante. | Se infiere desde obra de cabecera; no hay historial físico autoritativo. |
| Estado agregado de cabecera | Resultado de considerar todas sus participaciones (por ejemplo, ninguna, algunas o todas retiradas). | **No existe** una regla de agregación implementada. |

No se deben usar estos términos como sinónimos. Una fecha contractual vencida tampoco prueba por sí sola un retiro físico, y una prolongación no implica movimiento.

### 3.3 Ciclo conceptual acordado frente al sistema actual

| Hecho de negocio acordado | Objetivo conceptual | Comportamiento verificable actual / brecha |
|---|---|---|
| Entrega física respaldada por guía | Una guía respalda la salida/entrega de las máquinas identificadas; la operación debe conservar su cobertura. | La emisión de GD se relaciona con la cabecera y OT, sin vínculo por ítem; para `ALTA` el destino procede de la obra del arriendo ([`backend/api/views.py`, líneas 917-943](../../backend/api/views.py#L917-L943)). |
| Prolongación sin nuevo movimiento físico | Extiende vigencia o condición temporal de la participación; no crea por sí misma una entrega ni traslado. | `PROL` comparte actualmente la rama que puede crear otra cabecera desde la primera línea y el emisor genérico puede crear una GD; esto no modela de forma fiable la regla acordada ([`backend/api/views.py`, líneas 663-689](../../backend/api/views.py#L663-L689), [`backend/api/views.py`, líneas 882-906](../../backend/api/views.py#L882-L906)). |
| Retiro por máquina con guía de retiro | Cada máquina seleccionada se retira con trazabilidad documental; la cabecera termina solo cuando la regla agregada lo permita. | La UI prepara un retiro con `arriendo_id` y serie ([`frontend/src/components/EstadoArriendoMaquinas.jsx`, líneas 91-108](../../frontend/src/components/EstadoArriendoMaquinas.jsx#L91-L108)); emitirlo marca la guía como retiro, termina toda la cabecera y libera la FK singular. |
| Traslado con origen y destino trazables | Registra el cambio físico de una máquina entre ubicaciones, preservando ambos extremos. | El modelo admite ambas obras, pero la rama `TRAS` de emisión deja `obra_origen=None` y toma como destino la obra de cabecera; no hay movimiento por activo ([`backend/api/views.py`, líneas 920-925](../../backend/api/views.py#L920-L925)). |

Estas reglas describen semántica de negocio, no exigen todavía una forma de tabla, un proveedor tributario ni emisión DTE.

### 3.4 Invariantes de migración

1. **No inventar historia:** una serie textual, una posición en JSON o una coincidencia aproximada no basta para crear una relación histórica. Los casos ambiguos permanecen clasificados para revisión.
2. **Retiro aislado:** retirar un ítem activo no puede terminar toda la cabecera mientras otro ítem siga activo, salvo una futura excepción de negocio explícita y auditable.
3. **GET sin efectos:** consultas de estado, historial, disponibilidad o documentos no crean ni corrigen cabeceras, ítems, estados, ubicaciones o documentos.
4. **Atomicidad:** toda operación que deba ser indivisible —por ejemplo, cabecera + ítems + OT, o guía de retiro + transición del ítem + eventual agregado de cabecera— confirma todos sus cambios o ninguno.
5. **Identidad documental:** se conservan PK, tipo, número, fecha, relación de cabecera, relaciones entre documentos y significado histórico. No se atribuye cobertura por máquina retrospectivamente sin evidencia.
6. **Una autoridad operativa:** durante compatibilidad, el escritor centralizado debe impedir divergencia entre ítems y proyecciones legacy; después del corte, FK y JSON no vuelven a decidir semántica.
7. **Identidad por PK:** las nuevas relaciones usan identificadores persistentes validados; la serie queda como dato visible o snapshot, no como clave de integración.
8. **Sin doble efecto físico:** prolongar no produce movimiento; entregar, trasladar y retirar sí requieren trazabilidad física según la regla acordada.

## 4. Modelo objetivo propuesto para próximas fases

### 4.1 Fuente de verdad y escritura compatible

La próxima fase propuesta es un único camino de escritura compatible que, dentro de una transacción:

1. reciba PKs explícitas de máquinas y valide pertenencia, duplicados y condiciones aprobadas;
2. cree o seleccione la cabecera según reglas explícitas;
3. cree una participación `ArriendoItem` por activo aprobado;
4. derive `Arriendo.maquinaria` como proyección singular temporal con un orden determinista documentado;
5. conserve `detalle_lineas` como snapshot/contrato legacy, pero sin usar sus series como autoridad;
6. cree la OT y falle sin residuos si falla cualquier parte.

Esto es una **propuesta**, no comportamiento actual. Antes de activarla deben resolverse las decisiones prioritarias de la sección 6, definir cómo rechazar divergencias y acordar compatibilidad para clientes que solo comprenden una máquina. El corte de autoridad solo será posible cuando escritura, lecturas, estados, retiro, historial y documentos dejen de consultar la FK singular para su semántica y exista evidencia de paridad.

### 4.2 Ciclo objetivo mínimo

* **Entrega:** seleccionar ítems inequívocos, emitir o asociar la guía que respalda la entrega y reflejar la transición operativa de cada uno atómicamente.
* **Prolongación:** asociar el cambio temporal/comercial a los ítems afectados sin registrar un movimiento físico inexistente.
* **Retiro parcial:** seleccionar uno o más ítems, generar la guía de retiro, registrar su retorno y mantener activa la cabecera si quedan participaciones activas.
* **Retiro total:** aplicar el mismo mecanismo por ítem; solo después, una regla agregada explícita permite terminar la cabecera.
* **Traslado:** identificar cada ítem y conservar origen, destino y fecha; no sustituir el origen por `null` si la operación exige trazabilidad.

Todavía no se fija el vocabulario de estados, la política de reingreso, la granularidad documental ni el algoritmo definitivo de agregación.

### 4.3 Extensiones posteriores, deliberadamente no implementadas

Un futuro **período** podría representar vigencia y precio temporal de una participación, especialmente para prolongaciones. Un futuro **`MovimientoMaquinaria`** podría registrar entrega, traslado o retorno con fecha, origen y destino y convertirse en fuente de ubicación. Una futura línea documental podría asociar cobertura económica/documental a un ítem.

Estos son conceptos de diseño, **no tablas, campos ni contratos ya decididos**. No se crean ni se anticipan en esta tarea; requieren reglas propias y deben llegar después de estabilizar la escritura y lectura de `ArriendoItem`.

## 5. Puntos de impacto obligatorios por fase

Cada fase funcional futura debe declarar qué cambia y verificar, como mínimo:

| Área | Pregunta de revisión |
|---|---|
| Escritura | ¿Se escriben cabecera, ítems, proyección legacy, snapshot y OT desde un solo servicio y con atomicidad? |
| Lecturas | ¿Qué endpoint usa ítems y cómo evita que un consumidor singular omita máquinas adicionales? |
| OT | ¿Cada línea porta PK de maquinaria/ítem, conserva snapshot y deja de inferir relaciones desde serie? |
| Estado de arriendo | ¿El estado comercial y el agregado de cabecera se mantienen separados del estado operativo por ítem? |
| Bodega y disponibilidad | ¿Todas las participaciones activas excluyen correctamente la máquina, sin basarse solo en la FK legacy o en la fecha prevista? |
| Ubicación | ¿La vista informa una fuente física trazable o etiqueta claramente una inferencia transitoria? |
| Documentos | ¿Se preserva la identidad histórica y se conoce, sin inventarla, la cobertura de cabecera o ítem? |
| Retiro | ¿La selección es por ítem, el retiro parcial no cierra los demás y guía/cambios son atómicos? |
| Historial | ¿Incluye todas las participaciones y distingue hechos demostrados de documentos solo vinculados a la cabecera? |
| Compatibilidad | ¿Se mide divergencia y existe reversión segura sin volver a crear dos fuentes independientes? |

## 6. Decisiones abiertas prioritarias antes de escritura compatible

1. **Contrato de entrada multi-máquina y duplicados.**
   * **Evidencia:** el frontend envía series; el servidor admite texto no resoluble y repeticiones, mientras `ArriendoItem` no tiene constraint de unicidad.
   * **Recomendación:** exigir una colección de `maquinaria_id` explícitos, rechazar IDs repetidos dentro de la operación y mantener serie solo como snapshot.
   * **No decidible aún:** si una misma máquina puede participar más de una vez en una cabecera por salida/reingreso; esa regla condiciona la unicidad persistente.
2. **Proyección temporal `Arriendo.maquinaria`.**
   * **Evidencia:** API, historial, bodega, ubicación y retiro todavía dependen de ella.
   * **Recomendación:** derivarla dentro del escritor desde el primer ítem según orden estable y prohibir que se edite por separado; tratarla explícitamente como compatibilidad.
   * **No decidible aún:** cuánto dura la ventana ni cómo debe responder cada consumidor singular ante una cabecera plural.
3. **Estado operativo inicial y agregado de cabecera.**
   * **Evidencia:** `ArriendoItem` no tiene estado y el retiro actual termina `Arriendo.estado` completo.
   * **Recomendación:** acordar un vocabulario mínimo y una función de agregación antes de habilitar retiro por ítem; impedir cierre total con participaciones activas por defecto.
   * **No decidible aún:** estados exactos, transiciones excepcionales, reapertura y autoridad para overrides.
4. **Semántica de `PROL` al escribir.**
   * **Evidencia:** hoy puede crear una cabecera nueva y pasar por emisión de GD, en tensión con la regla de “sin movimiento físico”.
   * **Recomendación:** exigir cabecera e ítems existentes para una prolongación y no generar movimiento; diferir precio/vigencia detallados hasta decidir períodos.
   * **No decidible aún:** si prolongar modifica fechas/tarifas comunes, datos por ítem o un período futuro.
5. **Cobertura de guía y selección por ítem para entrega/retiro/traslado.**
   * **Evidencia:** `Documento` pertenece a la cabecera, la OT tiene una guía singular y el JSON no contiene IDs; traslado no registra hoy un origen efectivo.
   * **Recomendación:** el próximo contrato debe transportar los IDs afectados y conservar una asociación auditable sin reinterpretar documentos antiguos.
   * **No decidible aún:** si la asociación futura será directa, mediante líneas documentales o mediante movimientos; tampoco si una guía puede cubrir subconjuntos de varias cabeceras.

Estas decisiones bloquean o condicionan la primera escritura compatible. Disponibilidad concurrente, doble arriendo, períodos, movimientos normalizados, líneas documentales, contabilidad, multitenancy y la edición .NET quedan fuera de esa primera fase salvo un nuevo alcance aprobado.

## 7. Discrepancias conocidas y criterio de no resolución

* El diseño arquitectónico original decía que `ArriendoItem` aún no existía; el repositorio actual ya contiene modelo, migración y herramientas. Su conclusión operativa sigue vigente: continúa en sombra y no es autoridad.
* `Maquinaria.estado` declara un vocabulario reducido, mientras los flujos históricos usan valores adicionales; por ello no se puede elevar el campo actual a estado operativo fiable sin una decisión.
* La pluralidad de `detalle_lineas` contrasta con las FKs singulares de OT y cabecera. Mostrar varias series no demuestra varias relaciones persistidas.
* Las reglas acordadas de prolongación, retiro individual y traslado trazable no coinciden plenamente con las ramas actuales descritas arriba. Esta baseline registra la brecha; no la corrige ni afirma que el código ya cumpla.
* Los documentos actuales permiten tipos y relaciones internas, pero eso no demuestra emisión DTE real ni autoriza inferir cobertura por máquina.

Ante una contradicción entre dato legacy y evidencia relacional determinista, la migración debe reportar y detener la automatización de ese caso; no corregir silenciosamente el historial.
