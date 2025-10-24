# backend/api/admin_site.py
from django.contrib import admin
from django.utils.translation import gettext_lazy as _

class AppWebMaquinasAdmin(admin.AdminSite):
    # Branding
    site_header = _("App web máquinas – Administración")
    site_title  = _("App web máquinas")
    index_title = _("Panel de Gestión")

    # 🔐 Solo permitir acceso a superusuarios
    def has_permission(self, request):
        # Por defecto AdminSite permite is_staff; aquí lo limitamos a is_superuser
        return bool(request.user and request.user.is_active and request.user.is_superuser)

    def get_app_list(self, request):
        """
        Reorganiza el sidebar del admin en 3 bloques principales (Clientes, Maquinaria, Documentos)
        y, solo para superadmin, agrega el bloque Administración (Usuarios, Grupos, Seguridad).
        """
        base = super().get_app_list(request)  # modelos ya registrados en ESTE AdminSite

        # Aplanar modelos para indexarlos por object_name y por name (defensivo)
        all_models = []
        for app in base:
            for m in app.get("models", []):
                all_models.append(m)

        by_object_name = {m.get("object_name"): m for m in all_models}
        by_name        = {m.get("name"):        m for m in all_models}

        def pick(label):
            """Busca un modelo por object_name y si no, por name. Devuelve None si no existe."""
            return by_object_name.get(label) or by_name.get(label)

        # Grupos visibles para todos los que pasan has_permission (o sea, solo superadmin)
        grupos = [
            ("Clientes",   ["Cliente", "Obra"]),
            ("Maquinaria", ["Maquinaria", "Arriendo"]),
            ("Documentos", ["Documento"]),
        ]

        # Bloque de administración SOLO para superadmin (redundante pero explícito)
        if request.user.is_superuser:
            grupos.append(("Administración", ["User", "Group", "UserSecurity"]))

        # Construir "apps virtuales" en el orden indicado
        virtual_apps = []
        order = 1
        for group_name, model_labels in grupos:
            items = []
            for label in model_labels:
                m = pick(label)
                if m:
                    items.append(m)

            if not items:
                continue

            virtual_apps.append({
                "name": group_name,
                "app_label": f"vw_{group_name.lower()}",
                "app_url": "",
                "has_module_perms": True,
                "models": items,
                "_order": order,
            })
            order += 1

        # El admin espera sin claves extra; ordenamos y quitamos _order
        virtual_apps.sort(key=lambda a: a.pop("_order"))
        return virtual_apps

# Instancia única del AdminSite propio
admin_site = AppWebMaquinasAdmin(name="appweb_admin")




