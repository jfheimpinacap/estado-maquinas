# Contrato propuesto de escritura multi-máquina

## 1. Estado y alcance de esta especificación

**Propuesta del Prompt 029**, contrastada con la base
`23cd2a5d188c50f7ef90185d88d99a759bb4be80` (merge del Prompt 028).
Este documento no implementa ni activa endpoints, flags, servicios o cambios de
modelo. Los nombres y contratos de las secciones 3 a 9 son recomendaciones para
una implementación posterior autorizada. Ninguna condición de activación se da
por cumplida por documentarla aquí.

El [diseño incremental original](multi-machine-design.md) se conserva como
antecedente histórico: sus afirmaciones sobre la inexistencia de `ArriendoItem`
describen aquella base, no la actual. La [baseline de dominio](../domain/rentals-and-machinery.md)
y la sección siguiente permiten distinguir lo implementado de lo propuesto.
Primero se termina y estabiliza Django; esta secuencia no inicia .NET.

## 2. Baseline implementada y límites comprobables

| Hecho actual | Evidencia concreta | Límite para pluralidad |
|---|---|---|
| `ArriendoItem` tiene PK, FK protegida a cabecera y maquinaria e índice conjunto. No tiene unicidad del par, estado operativo, fechas o tarifa propios. | [models.py](../../backend/api/models.py), `Arriendo`, `ArriendoItem` | La pertenencia persistida no demuestra entrega, vigencia, ubicación ni retiro; duplicados históricos siguen siendo posibles. |
| Escritura singular optativa de cabecera + ítem y de ALTA + cabecera + ítem. Los servicios son atómicos; la ALTA optativa incluye la resolución/creación de obra dentro de una transacción exterior. | [rental_writes.py](../../backend/api/services/rental_writes.py), `create_singular_rental_with_item`, `create_singular_rental_with_item_and_order`; [views.py](../../backend/api/views.py), `ArriendoViewSet.create`, `OrdenTrabajoViewSet.create` | Exige exactamente una PK; la ALTA requiere cabecera nueva. El camino legacy no adquiere por ello atomicidad global. |
| `ENABLE_SINGULAR_ARRIENDO_ITEM_WRITE = False` y `ENABLE_ARRIENDO_ITEM_SHADOW_READ = False`. | [settings.py](../../backend/estado_maquinas/settings.py) | Lectura y escritura son capacidades independientes; ninguna habilita creación plural. |
| GET de arriendos puede añadir `items_sombra` y diagnóstico; GET de participaciones por maquinaria devuelve ítems persistidos por PK, ordenados, con duplicados visibles. | [serializers.py](../../backend/api/serializers.py), `ArriendoSerializer`; [views.py](../../backend/api/views.py), `ArriendoViewSet.get_queryset`, `MaquinariaViewSet.participaciones_sombra` | El flag de lectura no cambia la autoridad; `cobertura_completa_demostrada` permanece false. La acción por maquinaria exige usuario activo staff/superusuario. |
| Ambos POST rechazan `maquinaria_ids` sin opt-in; el opt-in acepta solo booleanos JSON. La creación de OT comprueba todas las líneas antes de escribir: objetos y series no nulas de texto. | [views.py](../../backend/api/views.py), `OrdenTrabajoViewSet.create`; [serializers.py](../../backend/api/serializers.py), `ArriendoSerializer.validate`; [rental_writes.py](../../backend/api/services/rental_writes.py), `validate_order_line_series`, `validate_singular_machine_selection` | El Prompt 028 protege entradas nuevas, no normaliza JSON histórico ni habilita varios activos. |
| La actualización API de arriendo protege la maquinaria cuando se envía ese campo; con ítems plurales/discrepantes lo rechaza. Otros campos pueden actualizarse si se omite la maquinaria. Admin valida el campo maquinaria mediante su formulario. | [serializers.py](../../backend/api/serializers.py), `ArriendoSerializer.validate`; [admin.py](../../backend/api/admin.py), `ArriendoAdmin.ArriendoChangeForm.clean_maquinaria` | No es un bloqueo general de edición plural; tampoco protege por sí mismo todos los campos de una OT. |
| OT expone `arriendo`, `maquinaria`, `detalle_lineas` y campos comerciales editables por el serializer; el ViewSet conserva actualización ordinaria. Admin de OT usa el formulario general. | [serializers.py](../../backend/api/serializers.py), `OrdenTrabajoSerializer`; [views.py](../../backend/api/views.py), `OrdenTrabajoViewSet`; [admin.py](../../backend/api/admin.py), `OrdenTrabajoAdmin` | No existe todavía una garantía que mantenga sincronizados cabecera, ítems y snapshot al editar OT. |
| Emisión, retiro, estados, bodega, ubicación e historial siguen navegando la FK singular. | Símbolos de la matriz de la sección 6 | Los activos adicionales pueden omitirse o aparecer disponibles; la proyección no corrige esas rutas. |
| Documento pertenece a cabecera; OT tiene guía y factura singulares. No hay relación documental persistente con ítem. | [models.py](../../backend/api/models.py), `Documento`, `OrdenTrabajo`; [views.py](../../backend/api/views.py), `OrdenTrabajoViewSet.emitir` | Ni un documento de cabecera ni IDs en JSON acreditan cobertura por activo. |

Las contenciones existentes también importan: `CriticalEntityViewSet` impide
borrado, `DocumentoViewSet` es de lectura, Admin bloquea borrados críticos y
edición documental e inlines (`NoCriticalDeletionAdminMixin`, `DocumentoAdmin`,
`ProtectedInlineMixin`). El borrado de OT sigue su política propia: superusuario
y rechazo cuando hay documentos emitidos; no se sustituye esa política aquí.

Las regresiones leídas son evidencia de contratos escritos, no pruebas ejecutadas
en esta tarea documental: [022](../../backend/api/tests/test_prompt_022_singular_arriendo_item_write.py),
[023](../../backend/api/tests/test_prompt_023_direct_singular_rental_write.py),
[024](../../backend/api/tests/test_prompt_024_admin_rental_machine.py),
[025](../../backend/api/tests/test_prompt_025_arriendo_item_shadow_read.py),
[027](../../backend/api/tests/test_prompt_027_machinery_shadow_participations.py) y
[028](../../backend/api/tests/test_prompt_028_order_input_contract.py).
El 026 fue documental. Las contenciones relevantes anteriores están en
[011](../../backend/api/tests/test_prompt_011_containment.py),
[012](../../backend/api/tests/test_prompt_012_billable_dispatch.py) y
[013](../../backend/api/tests/test_prompt_013_rental_warehouse_state.py): permisos,
conservación documental, GD facturable pendiente de FACT, GET sin escrituras y
exclusión de bodega mientras la cabecera sigue activa, incluso vencida.

## 3. Primer incremento recomendado: ALTA nueva experimental

Recomendar **un servicio nuevo de creación**, sin ampliar el validador singular,
y un único adaptador futuro `POST /ordenes/alta-multi`, sin slash final. La ruta
misma es el opt-in explícito; no acepta el opt-in singular. Su permiso será
`IsStaffOrSuperUser`, incluyendo autenticación y usuario activo, igual que crear OT.

Proponer `ENABLE_MULTI_MACHINE_ALTA_WRITE = False` como capacidad independiente;
ese nombre no existe aún en settings. Para usuarios autorizados, desactivado
responderá 404 sin efectos. Activarlo no dependerá de los otros dos flags ni los
modificará. Inicialmente solo se habilitará en tests con `override_settings` y en
entornos de evaluación con datos sintéticos, nunca en la base operacional.

Cada solicitud aceptada creará **una cabecera nueva, N ítems y una OT ALTA nueva**,
con N >= 1. Admitir una máquina en esta ruta permite verificar el mismo contrato
antes de probar varias; no cambia `POST /ordenes` ni `POST /arriendos` existentes.
No creará documentos ni cambiará `Maquinaria.estado` o ubicación física.

El incremento usará cliente y obra existentes, una obra común y condiciones
comunes a todas las máquinas. Diferirá altas implícitas de clientes/obras, tarifas
heterogéneas y múltiples obras. Es una restricción recomendada del experimento,
no una regla comercial ya aprobada. No se agregarán estado, fechas o tarifa al ítem.

Permanecen fuera reutilización de cabeceras, reingresos, PROL, retiro total o
parcial mediante esta capacidad, traslado, períodos y cobertura documental por
ítem. Se pueden diferir para construir el escritor aislado porque solo crea
pertenencias nuevas; no se puede usar esa exclusión para permitir luego que un
consumidor legacy ejecute esas operaciones sobre registros plurales.

## 4. Contrato único recomendado

### 4.1 Entrada

Ejemplo completo, ilustrativo y todavía no disponible:

```json
{
  "cliente_id": 7,
  "obra_id": 12,
  "condiciones_comunes": {
    "fecha_inicio": "2026-11-02",
    "fecha_termino": "2026-11-02",
    "periodo": "Dia",
    "tarifa": "1000.00"
  },
  "lineas": [
    {"maquinaria_id": 20},
    {"maquinaria_id": 10}
  ]
}
```

Reglas propuestas, validadas íntegramente antes de escribir:

1. Objeto JSON con exactamente las propiedades del ejemplo; `condiciones_comunes`
   también es objeto y cada línea contiene únicamente `maquinaria_id`. Campos
   desconocidos se rechazan: evita que una intención enviada se ignore.
2. `cliente_id`, `obra_id` y cada `maquinaria_id` son enteros JSON positivos de PK
   existente. Booleanos, floats, strings, null y objetos no se convierten. Cliente
   y obra son obligatorios; no se resuelven por nombre ni se crean implícitamente.
   `Obra` no tiene FK a cliente: comprobar existencia no demuestra pertenencia;
   cualquier restricción comercial Cliente–Obra necesita regla aprobada.
3. `lineas` es lista no vacía de objetos; cada PK aparece una vez. Se rechazan
   duplicados aun cuando las líneas difieran en otros datos. No se deduplican.
   El escritor rechaza más campos, incluida una `serie` aportada por el cliente:
   la serie de salida se toma del catálogo de la PK. No se usa texto ni posición
   para seleccionar o asociar un ítem.
4. **No se conserva `maquinaria_ids` en esta ruta nueva**. Su mera presencia, también
   null o [], produce 400. Tampoco admite `crear_arriendo_item`, `tipo`, `arriendo`,
   `arriendo_id`, `maquinaria`, IDs de ítem ni `detalle_lineas` enviados. Solo hay
   una selección, las PK en `lineas`; no se resuelve por posición una divergencia
   entre listas redundantes. En las rutas existentes se mantiene el contrato 028.
5. Fechas como cadenas ISO `YYYY-MM-DD`, válidas y obligatorias; término no anterior
   al inicio. `periodo` exactamente `Dia`, `Semana` o `Mes`. `tarifa` como cadena
   decimal no negativa con dos decimales, finita y dentro de los límites actuales
   de `Arriendo.tarifa`; sin parseo de nombres ni valores de verdad. Todas las
   máquinas comparten esos valores; no se aceptan overrides de línea.
6. El conjunto se normaliza por `maquinaria_id` ascendente antes de crear ítems,
   snapshot y respuesta. Mismo conjunto produce el mismo orden y proyección
   independientemente del orden recibido. No promete las mismas PK en otro POST.

Para mantener el experimento pequeño, el snapshot de cada línea usará las
condiciones comunes y la serie actual del catálogo (admite null si la máquina no
tiene serie). `valor` será la tarifa común, `flete` cero y `cantidadPeriodo` uno;
unidad y fechas serán las comunes. Totales se calcularán del lado servidor con
la misma aritmética de `OrdenTrabajoViewSet.create` (`neto = valor + flete`, IVA
del 19 % redondeado a centavos, suma de líneas), sin inferir duración ni multiplicar
por días. Ningún total se recibe del cliente. Es una convención experimental que
requiere validación comercial antes de operar, no una definición de facturación.
La futura implementación deberá validar también los límites de los montos de OT.

### 4.2 Salida y snapshot

Respuesta 201 completa para el contrato mínimo propuesto; números ilustrativos:

```json
{
  "arriendo": {
    "id": 50,
    "cliente_id": 7,
    "obra_id": 12,
    "maquinaria_legacy_id": 10,
    "fecha_inicio": "2026-11-02",
    "fecha_termino": "2026-11-02",
    "periodo": "Dia",
    "tarifa": "1000.00",
    "estado": "Activo"
  },
  "orden": {
    "id": 80,
    "tipo": "ALTA",
    "estado": "PEND",
    "maquinaria_legacy_id": 10
  },
  "participaciones": [
    {"arriendo_item_id": 100, "arriendo_id": 50, "maquinaria_id": 10, "serie_snapshot": "EQ-10"},
    {"arriendo_item_id": 101, "arriendo_id": 50, "maquinaria_id": 20, "serie_snapshot": "EQ-20"}
  ],
  "fuente": "ArriendoItem",
  "cobertura_completa_demostrada": false
}
```

Los IDs salen de las filas creadas por el servidor dentro de la transacción.
Cada participación se vincula por PK de maquinaria al ítem de esa misma cabecera;
no mediante `zip` de listas devueltas por la base ni por coincidencia de series.
`Activo` y `PEND` reutilizan valores actuales de creación, no agregan estados ni
demuestran que una máquina haya salido físicamente. Precisamente por afectar ya
a consultas legacy, crear esos registros solo es admisible experimentalmente en
una base aislada hasta cumplir las condiciones operacionales de la sección 7.

Se recomienda guardar en `OrdenTrabajo.detalle_lineas` los valores normalizados
y los IDs `maquinaria_id` y `arriendo_item_id` generados. Es **snapshot de captura**;
la FK de `ArriendoItem` prueba pertenencia, el JSON no la reemplaza. La respuesta
se construye desde las relaciones persistidas y la captura validada. Antes de
exponer la ruta, bloquear PUT/PATCH/Admin que cambien el snapshot, vínculos,
proyecciones, cliente, obra, condiciones o montos de esas cabeceras/OTs; para el
primer incremento se recomienda dejarlas de solo lectura tras creación, hasta
tener un servicio de edición con reglas propias. Ninguna corrección será por GET.

No se rellenarán IDs en JSON histórico por inferencia. Guardarlos en una OT nueva
no añade FK a `Documento`, no identifica qué ítems cubre una guía/factura y no
autoriza atribuir documentos de cabecera a cada participación. El snapshot no
modifica por sí mismo lecturas ni historial; las protecciones futuras de sus
consumidores se detallan en la sección 6.

### 4.3 Errores y límites del reintento

| Situación propuesta | Respuesta | Efectos |
|---|---|---|
| Sin autenticación / sin permiso interno activo | 401 / 403, conforme a la autenticación vigente | Ninguno; permiso antes del flag. |
| Capacidad desactivada para usuario autorizado | 404 | Ninguno. |
| Forma, campo desconocido, duplicados, tipo de PK o PK inexistente | 400 asociado a `cliente_id`, `obra_id`, `condiciones_comunes`, `lineas` o al campo prohibido | Sin clientes, obras, cabeceras, ítems, OTs ni documentos creados/modificados. |
| Intento legacy de operar un registro plural o incoherente no soportado | 409 con código propuesto `multi_machine_not_supported`; validación de formularios en Admin | Sin elegir silenciosamente una máquina ni producir efectos parciales. |
| Referencia desaparece entre validación y escritura | Revalidación transaccional; 400 controlado para referencia inválida | Rollback de toda la operación. |
| Fallo interno inesperado de persistencia | Error del servidor y registro técnico sin secretos; no se oculta como validación | Rollback completo, sin respuesta 201. |

No se promete idempotencia entre POST repetidos: cada solicitud aceptada crea
una nueva ALTA. Un timeout con resultado incierto no permite reintentar a ciegas;
la exposición deberá documentar cómo conciliar el resultado, o implementar antes
una clave de idempotencia si el consumidor exige reintento automático. No se
inventan aquí campos persistentes para ese mecanismo.

## 5. Política propuesta de proyección legacy

Recomendar `Arriendo.maquinaria_id = min(PK de maquinarias seleccionadas)` y la
misma proyección para `OrdenTrabajo.maquinaria_id`, establecidas solo por el
escritor. Con una máquina coincide con la única participación; con varias sirve
para compatibilidad de forma, búsquedas antiguas y etiqueta representativa.
No significa máquina principal de negocio, prioridad, cobertura completa,
ubicación, entrega, disponibilidad ni autorización de retiro.

La menor PK evita depender del orden de UI o de generación de IDs de ítem. La
tarifa común evita inventar un agregado comercial en la cabecera; no es el total
del conjunto. Ambas son recomendaciones técnicas de compatibilidad: el usuario
debe aprobar que una representación singular siga visible y las restricciones
comerciales comunes antes de exposición operacional.

No admitir edición independiente de ambas FKs, de las participaciones ni de los
IDs del snapshot. Detectar incompatibilidad desde datos persistidos: más de un
ítem (incluidos repetidos), un ítem discrepante o FK legacy nula con ítems exige
rechazo/revisión, no deducir que es singular por tener una sola maquinaria distinta.
Para activar la nueva ruta también se debe proteger su caso N=1 con snapshot de
IDs; el origen no se deduce de una serie ni de un flag. La protección cubrirá los
OTs con esas referencias persistidas y sus cabeceras asociadas.

Un consumidor singular que intente operar una cabecera plural recibirá el error
explícito anterior. La recomendación inicial para consultas legacy incapaces de
expresar pluralidad es responder 409 `multi_machine_not_supported`, no devolver
solo el representante. En listas se rechaza la consulta afectada, sin ocultar
filas; la detección debe considerar todas las participaciones pertinentes antes
de que los filtros legacy omitan activos adicionales o cabeceras sin documentos.
En Admin se muestra incompatibilidad y se bloquea la acción correspondiente, sin
presentar una ubicación inferida como cierta. Sustituir ese bloqueo por una
lectura completa necesita un incremento explícito y sus pruebas antes de operar.
La acción de participaciones en sombra puede conservar su diagnóstico relacional
sin atribuciones operativas. No se cambian los contratos de registros singulares
legacy válidos; las nuevas capturas N=1 mantienen la protección de snapshot.

## 6. Matriz de compatibilidad y protecciones necesarias

Todas las protecciones siguientes son trabajo futuro, no garantías ya existentes.
«Antes de exposición» incluye cualquier consumidor conectado a una base que
contenga las nuevas altas, aunque no invoque su ruta de creación.

| Ruta o componente actual | Supuesto singular / riesgo plural | Protección o adaptación requerida | Debe resolverse |
|---|---|---|---|
| `POST /ordenes`, `OrdenTrabajoViewSet.create` | Reutiliza cabecera y su FK; puede adjuntar PROL/TRAS/RETI a un plural. | Conservar 028 y ruta singular; rechazar reutilización de plural/incoherente antes de resolver cliente/obra o crear OT. | Antes de exposición. |
| `POST /arriendos`, `ArriendoViewSet.create` | Un activo o selección singular, no contrato plural. | No ampliar su flag/semántica; rechazar campos exclusivos de la nueva capacidad, sin ignorarlos. | Antes de exposición; regresión desde escritor experimental. |
| PUT/PATCH de arriendos, `ArriendoSerializer.validate` | El bloqueo actual depende de enviar `maquinaria`; se puede cambiar estado/obra sin ella. | Proteger toda edición de las nuevas cabeceras y operaciones sobre plurales/incoherentes, incluso omitiendo FK; readonly hasta un servicio autorizado. | Antes de exposición, con el flag nuevo encendido y apagado. |
| PUT/PATCH y borrado de OT, `OrdenTrabajoSerializer`, `OrdenTrabajoViewSet.destroy` | Cambiar `arriendo`, `maquinaria`, JSON, estados o montos puede romper el vínculo; una OT sin documentos puede borrarse hoy según permiso. | Bloquear edición/borrado de la captura nueva mientras no exista política específica; conservar borrado documentado y permisos previos en el resto. | Antes de exposición. |
| Django Admin: `ArriendoAdmin`, `OrdenTrabajoAdmin`, inlines | La protección 024 no es una edición plural centralizada; OT es editable por formulario general. | Misma validación del servicio o solo lectura para registros nuevos/plurales; mantener `ProtectedInlineMixin`, `NoCriticalDeletionAdminMixin` y documento readonly. | Antes de exposición, sin atajos de superusuario. |
| `/ordenes/{id}/emitir`, `_ensure_arriendo_for_ot`, `_infer_maquinaria_from_ot` | Documenta cabecera y puede inferir un activo desde FK/serie. | Rechazar emisión plural antes de folios/escrituras; no reconstruir pertenencia por series. Mantener GD facturable pendiente de FACT en singulares. | Bloqueo antes de exposición; adaptación aprobada antes de emisión operacional plural. |
| RETI al crear y emitir OT | Termina cabecera entera y libera solo `arr.maquinaria`; podría cerrar otros activos. | Bloquear creación/emisión de RETI sobre plural; después diseñar selección por ítem, transición y agregado con respaldo documental. | Bloqueo antes de exposición; semántica completa antes de admitir retiros operacionales. |
| `/ordenes/estado-arriendos`, `_active_rentals` | Una fila por FK, exige documentos; adicionales y altas aún sin documentos pueden no figurar. | No ofrecer una fila parcial como cobertura total. Adaptar para mostrar todos los activos o error explícito de incompatibilidad. Definir antes de operar su semántica de asignación. | Contención antes de exposición; adaptación antes de operación. |
| `/ordenes/estado-bodega` y disponibilidad | `Exists` solo sobre FK singular; adicionales podrían ofrecerse disponibles. | Antes de operar, considerar todas las participaciones que la regla aprobada considere comprometidas; mientras falte esa regla, bloquear la consulta incompatible, sin excluir solo el representante. | Contención antes de exposición; disponibilidad y concurrencia resueltas antes de operar. |
| `MaquinariaSerializer.get_obra`, `MaquinariaAdmin.obra_actual` | Relación inversa legacy infiere obra o «Bodega» para adicionales. | Impedir una ubicación falsa; usar lectura explícita sin inferencia operacional o señal de incompatibilidad mientras no exista regla física aprobada. | Antes de exposición de esas vistas; ubicación operativa antes de operar. |
| `/maquinarias/{id}/historial`, navegación Admin | Solo cabeceras de la FK, con documentos de cabecera. | Mantener contrato legacy para singulares; para plural, adaptación explícita o error, sin historia parcial presentada como completa. | Antes de exposición; adaptación trazable antes de operación. |
| GET de arriendos, OT y `participaciones-sombra` | Unas formas son singulares; el diagnóstico sombra sí conserva todas las filas. | Lectores nuevos consumen colección persistida, sin colapsar duplicados. No transformar flag sombra en autoridad ni atribuir documentos por ítem. Evitar N+1 y efectos en GET. | Antes de exposición. |
| Consulta de documentos y `DocumentoAdmin` | Relación a cabecera, sin cobertura por ítem. | Conservar IDs, tipos, números, fechas, relaciones e importes históricos; etiquetar alcance de cabecera, sin rellenar cobertura inventada. | Siempre; diseño documental antes de nueva emisión plural. |

Las referencias de esta matriz son [views.py](../../backend/api/views.py),
[serializers.py](../../backend/api/serializers.py) y [admin.py](../../backend/api/admin.py).
No se propone arreglar otras rutas o anomalías fuera de estas dependencias.

## 7. Condiciones verificables por etapa

| Etapa | Evidencia necesaria para pasar | Qué sigue prohibido |
|---|---|---|
| Implementar y probar escritor experimental | Alcance posterior autorizado; contrato técnico aprobado; validaciones y servicio atómico con matriz de sección 8; flags independientes false; datos sintéticos y base aislada. | Crear datos operacionales, exponer ruta a usuarios ordinarios del sistema o afirmar disponibilidad/entrega por ítem. |
| Exponer a consumidores de evaluación | Protecciones de sección 6 integradas para todas las rutas accesibles; N=1 y N>1 protegidos; respuestas, permisos y política de reintento documentados; consumidor identifica PK/ítem sin fallback silencioso; entorno aislado comprobado. | Emisión/retiro plurales y uso de consultas incompletas para decidir operación. |
| Habilitar con datos operacionales | Aprobación del usuario de reglas comunes, proyección representativa, significado comercial/operativo de ALTA, estado/fechas/tarifas y compromisos de disponibilidad; bloqueo concurrente/regla de doble arriendo probados; lectores no omiten activos; plan de entrega/documentos y de retorno/cierre soportado y probado; consumidores API/Admin inventariados; plan de desactivación y trazabilidad aprobado. | Activar solo porque la transacción pasa o porque se eligió representante; generar altas que después no puedan entregarse o cerrarse con seguridad. |
| Cambiar autoridad hacia `ArriendoItem` | Escritores, estados, disponibilidad/bodega, ubicación, emisión/retiro e historial usan reglas por ítem aprobadas; dependencias singulares eliminadas de decisiones; evidencia de paridad y divergencias resueltas/clasificadas; historia documental preservada; consumidores migrados; observación y reversión verificadas. | Volver a la FK o al JSON como segunda autoridad independiente, o declarar completo un historial no demostrado. |

El retiro parcial puede seguir fuera del primer escritor. Pero antes de operar
debe existir un ciclo soportado de entrega y cierre para las altas creadas,
aprobado por el usuario; mientras no exista, la capacidad seguirá experimental.
No se inventa aquí una excepción de retiro total que sustituya esa decisión.

**Apagar el flag solo impide nuevas creaciones.** No elimina ni vuelve singulares
los registros existentes. Los bloqueos de edición, emisión, retiro y lectores
incompatibles se basarán en registros/relaciones, no en el flag de creación o de
lectura. No pueden desaparecer al apagarlo. El plan de contingencia conserva
cabeceras, ítems, OTs y documentos; no incluye borrar datos, rollback ni backfill
automático. Cualquier operación de datos requerirá alcance y autorización propios.

## 8. Atomicidad y matriz de aceptación futura

Frontera recomendada: comprobar autenticación/flag y estructura completa sin
efectos; dentro de **una transacción exterior** revalidar referencias necesarias,
crear cabecera con su proyección, crear N ítems, construir snapshot desde sus PK,
crear OT y preparar los datos de respuesta. Commit solo si todo termina bien;
no emitir documentos, mutar estados de maquinaria ni producir efectos externos.
El servicio no captura excepciones generales para devolver éxito o un falso 400.
El adaptador convierte únicamente fallos esperados de validación/referencia.

Cliente y obra ya existen: no se crean ni actualizan en este incremento, ni se
rellenan direcciones de una obra por conveniencia. Fallo al resolver obra debe
dejar cero escrituras. Si posteriormente se autoriza crear obra en la operación,
su creación debe estar en la misma transacción, como hoy en la ALTA singular
optativa, y se añadirá el caso de fallo de obra a las pruebas de rollback.

La atomicidad no impide por sí sola dos altas concurrentes del mismo activo.
La regla de reserva/disponibilidad y su mecanismo de concurrencia quedan
pendientes para operación; no se presupone que SQLite o el índice actual del par
proporcionen esa garantía. Tampoco se agrega unicidad global al par mientras el
reingreso siga abierto; la ausencia de duplicados se exige a cada ALTA nueva.

**Pruebas a escribir y ejecutar en una tarea posterior; ninguna se añade ni
ejecuta en el Prompt 029.**

| Caso de aceptación | Resultado exigido |
|---|---|
| Una PK y varias PK distintas | 201; exactamente una cabecera, una OT y N ítems; proyecciones iguales a menor PK; respuesta y snapshot corresponden a las filas creadas. |
| Mismo conjunto en orden inverso | Orden ascendente por maquinaria, misma proyección; sin asociar ítems por posición de entrada. No exigir PK generadas iguales entre solicitudes. |
| PK duplicada, inexistente, null, bool, float o string; lista vacía; línea no objeto | 400 de campo, sin crear ni modificar entidades, aunque otra línea anterior sea válida. |
| Cliente/obra inexistente o tipo inválido; condiciones inválidas | 400 asociado, sin resolución por nombre ni creación/modificación implícita; comprobar límites monetarios. |
| `maquinaria_ids` contradictorio, vacío o null; serie, ítem o snapshot enviados | 400: no hay selección redundante aceptada ni coerción. Verificar además invariantes línea–ítem–cabecera por PK en la salida. |
| Fallo al crear cabecera, cualquier ítem intermedio o OT | Rollback total, incluidos ítems anteriores; clientes, obras y datos existentes intactos. |
| Fallo/resolución de obra | Obra inválida: cero escrituras. No hay creación de obra en este contrato; si se amplía con autorización, fallo de creación y fallo posterior revierten también la obra nueva. |
| Permisos y flag | Anónimo 401, ordinario/inactivo 403, staff/superusuario activo permitido con flag; autorizado con flag off 404; ninguna dependencia del flag singular o sombra. |
| Rutas singulares 022/023 y validación 028 | Sus payloads válidos/respuestas, permisos, límites de PK y rollback no cambian. No aceptan pluralidad ni campos nuevos ignorados. |
| PUT/PATCH/Admin de cabecera/OT | Rechazo de cambio de FK, JSON/IDs, arriendo, cliente, obra, condiciones, montos o estado por vías no autorizadas; no eludir omitiendo `maquinaria`. Conservar registro singular legacy válido. |
| Plural preexistente, duplicados e ítem discrepante | No corregir/deduplicar/seleccionar uno; rechazo controlado en consumidor incompatible y diagnóstico de filas persistidas. |
| Flag nuevo o sombra apagado tras crear registros | Siguen las protecciones de datos, incluidos edición, borrado de captura, emisión y retiro; lecturas no operan solo con representante. |
| Emisión, PROL, TRAS y RETI legacy contra plural | Rechazo antes de folios, cliente empresa, documentos o estados; no liberar un solo activo ni terminar cabecera por accidente. |
| Estados, bodega, ubicación e historial | Adaptación aprobada completa o incompatibilidad explícita; ningún activo adicional se presenta libre/en bodega por omisión. Mantener activo vencido según regla 013 mientras no cambie por decisión explícita. |
| GET de listas, detalle, sombra e historial | Cero INSERT/UPDATE/DELETE y estado persistido idéntico; sin inferir relaciones históricas ni consultas por cada participación. |
| Documentos y GD facturable de singulares | Históricos intactos, permisos y solo lectura conservados; GD facturable sigue pendiente de FACT; no repartir documentos entre ítems sin vínculo demostrado. |
| Peticiones concurrentes / reintento incierto | No declarar garantía de exclusividad o idempotencia por atomicidad. Antes de operar, probar la regla aprobada de concurrencia y antes de automatizar reintentos resolver idempotencia/conciliación. |

## 9. Secuencia recomendada y decisiones pendientes

| Incremento sin número de prompt asignado | Dependencia y criterio de salida |
|---|---|
| Preparar escritor | Aprobar el contrato técnico mínimo; servicio nuevo, validación estricta y rollback con datos sintéticos. Sin ampliar servicios/flags singulares, sin exposición operacional. |
| Proteger compatibilidad | Después o junto al escritor, antes de conectar consumidores: cerrar atajos API/Admin, bloquear operaciones/lecturas incompatibles según sección 6; demostrar persistencia de bloqueos con flag off. |
| Integrar y exponer en evaluación | Matriz experimental aprobada y protecciones integradas; adaptador/flag independiente, consumidor por PK y snapshot inmutable; pruebas de extremo a extremo con datos sintéticos y política de reintento. |
| Adaptar operación | Resolver reglas de ALTA/compromiso, ciclo de entrega/cierre, estados agregados y por activo, disponibilidad concurrente y cobertura documental; adaptar lectores/operaciones antes de activar datos reales. |
| Cortar autoridad tras estabilización | Evidencia de sección 7, sin lectores/escritores operativos que dependan de FK singular; conservar historia y resolver casos no demostrados, sin adelantar .NET. |

Decisiones que necesitan respuesta del usuario, sin bloquear la redacción actual:

- **Antes de autorizar implementación experimental:** confirmar la ruta separada,
  selección única en líneas sin `maquinaria_ids`, admisión de N=1, cliente/obra
  existentes y condiciones comunes restringidas. Se recomienda ese conjunto para
  limitar el incremento. No requiere resolver reingresos ni crear nuevos estados.
- **Antes de exposición operacional:** aprobar significado de ALTA y asignación
  antes de guía, si las condiciones pueden ser comunes y la convención de importes
  sirve al negocio, si obra es común y su relación con cliente, y si se acepta una
  FK meramente representativa. Estas decisiones no se deducen de la primera línea.
- **Bloqueos operacionales reales:** regla de doble compromiso y concurrencia;
  ciclo seguro de entrega/retorno y agregado de cabecera; semántica de estados,
  fechas/precio y respaldo/cobertura documental para nueva emisión. No basta con
  mostrar relaciones en sombra para resolverlos.
- **Diferibles sin impedir el escritor aislado:** reutilización/reingreso y
  unicidad final del par, PROL/períodos, traslado/movimientos, tarifas/obras
  heterogéneas y normalización de líneas OT. Su implementación requiere alcance
  propio; no se infieren relaciones ni atribuciones históricas para anticiparla.

No se consultaron datos operacionales ni se inventariaron consumidores externos.
La especificación se apoya en código y tests del checkout; no demuestra por sí
misma paridad operacional, calidad de datos ni autorización para activar flags.
