from django.contrib import admin
from django.contrib.auth.models import User, Group
from django.contrib.auth.admin import UserAdmin, GroupAdmin

from .admin_site import admin_site
from .models import (
    Cliente, Maquinaria, Obra, Arriendo,
    Documento, OrdenTrabajo, UserSecurity
)

# =======================
# Inlines
# =======================

class DocumentoInline(admin.TabularInline):
    model = Documento
    extra = 0
    fields = ("tipo", "numero", "fecha_emision", "monto_total", "relacionado_con", "es_retiro")
    show_change_link = True

class ArriendoInlineForMaquinaria(admin.TabularInline):
    model = Arriendo
    extra = 0
    fields = ("cliente", "obra", "fecha_inicio", "fecha_termino", "periodo", "tarifa", "estado")
    autocomplete_fields = ("cliente", "obra")
    show_change_link = True

class ArriendoInlineForObra(admin.TabularInline):
    model = Arriendo
    extra = 0
    fields = ("maquinaria", "cliente", "fecha_inicio", "fecha_termino", "periodo", "tarifa", "estado")
    autocomplete_fields = ("maquinaria", "cliente")
    show_change_link = True

class ArriendoInlineForCliente(admin.TabularInline):
    model = Arriendo
    extra = 0
    fields = ("maquinaria", "obra", "fecha_inicio", "fecha_termino", "periodo", "tarifa", "estado")
    autocomplete_fields = ("maquinaria", "obra")
    show_change_link = True


# =======================
# ModelAdmin
# =======================
class MaquinariaAdmin(admin.ModelAdmin):
    list_display = ("marca", "modelo", "serie", "categoria", "estado", "obra_actual", "anio")
    list_filter = ("categoria", "estado", "anio")
    search_fields = ("serie", "marca", "modelo")
    ordering = ("marca", "modelo", "serie")
    inlines = (ArriendoInlineForMaquinaria,)
    fieldsets = (
        ("Identificación", {"fields": ("marca", "modelo", "serie")}),
        ("Especificaciones", {"fields": ("categoria", "descripcion", "altura", "anio", "tonelaje", "carga")}),
        ("Estado", {"fields": ("estado",)}),
    )

    @admin.display(description="Obra actual")
    def obra_actual(self, obj):
        arr = obj.arriendos.filter(estado="Activo").select_related("obra").order_by('-fecha_inicio', '-id').first()
        return arr.obra.nombre if arr and arr.obra_id else "Bodega"


class ClienteAdmin(admin.ModelAdmin):
    list_display = ("razon_social", "rut", "telefono", "correo_electronico", "forma_pago")
    search_fields = ("razon_social", "rut")
    list_filter = ("forma_pago",)
    inlines = (ArriendoInlineForCliente,)
    ordering = ("razon_social",)


class ObraAdmin(admin.ModelAdmin):
    list_display = ("nombre", "contacto_nombre", "contacto_telefono", "contacto_email", "direccion")
    search_fields = ("nombre", "contacto_email")
    inlines = (ArriendoInlineForObra,)
    ordering = ("nombre",)


class ArriendoAdmin(admin.ModelAdmin):
    list_display = ("id", "maquinaria", "cliente", "obra", "fecha_inicio", "fecha_termino", "periodo", "tarifa", "estado")
    list_filter = ("estado", "periodo", "obra")
    search_fields = ("maquinaria__serie", "cliente__razon_social", "obra__nombre")
    autocomplete_fields = ("maquinaria", "cliente", "obra")
    date_hierarchy = "fecha_inicio"
    inlines = (DocumentoInline,)
    ordering = ("-fecha_inicio", "-id")


class DocumentoAdmin(admin.ModelAdmin):
    list_display = ("tipo", "numero", "cliente", "fecha_emision", "monto_total", "relacionado_con", "es_retiro")
    list_filter = ("tipo", "fecha_emision", "es_retiro")
    search_fields = ("numero", "cliente__razon_social")
    autocomplete_fields = ("arriendo", "cliente", "relacionado_con", "obra_origen", "obra_destino")
    date_hierarchy = "fecha_emision"
    ordering = ("-fecha_emision", "-id")


class OrdenTrabajoAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo", "estado", "cliente", "maquinaria", "es_facturable", "factura", "guia", "fecha_creacion")
    list_filter = ("tipo", "estado", "es_facturable")
    search_fields = ("cliente__razon_social", "maquinaria__serie")
    autocomplete_fields = ("cliente", "maquinaria", "arriendo", "factura", "guia")
    date_hierarchy = "fecha_creacion"
    ordering = ("-fecha_creacion", "-id")


class UserSecurityAdmin(admin.ModelAdmin):
    list_display = ("user", "failed_attempts", "is_locked", "locked_at")
    list_filter = ("is_locked",)
    search_fields = ("user__username",)

# =======================
# Registro en AdminSite propio
# =======================
admin_site.register(Maquinaria, MaquinariaAdmin)
admin_site.register(Cliente, ClienteAdmin)
admin_site.register(Obra, ObraAdmin)
admin_site.register(Arriendo, ArriendoAdmin)
admin_site.register(Documento, DocumentoAdmin)
admin_site.register(OrdenTrabajo, OrdenTrabajoAdmin)
admin_site.register(UserSecurity, UserSecurityAdmin)

# Auth (con Django Admin estándar)
admin_site.register(User, UserAdmin)
admin_site.register(Group, GroupAdmin)
