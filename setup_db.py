# setup_db.py
# Crea la base de datos y las tablas necesarias para "Estado de máquinas"
# Funciona de forma idempotente: puedes correrlo varias veces sin romper nada.

import os
import sys
import pyodbc
from textwrap import dedent
from dotenv import load_dotenv

load_dotenv()  # lee variables de .env si existe

# --- Config por variables de entorno (con valores por defecto) ---
DB_NAME   = os.getenv("DB_NAME",   "MaquinasClientes")
DB_HOST   = os.getenv("DB_HOST",   r"localhost\SQLEXPRESS")   # ej: "localhost\\SQLEXPRESS"
DB_USER   = os.getenv("DB_USER",   "sa")
DB_PASS   = os.getenv("DB_PASSWORD", "Franz2024!")            # cambia la clave si corresponde
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")  # o "ODBC Driver 18 for SQL Server"

# Si usas Driver 18 y no tienes CA, agrega ;TrustServerCertificate=yes
EXTRA_PARAMS = os.getenv("DB_EXTRA", "TrustServerCertificate=yes;")

def connect_to(server_db="master"):
    # Intenta conectar con el driver indicado; si falla con 17, prueba 18
    drivers_to_try = [DB_DRIVER]
    if DB_DRIVER == "ODBC Driver 17 for SQL Server":
        drivers_to_try.append("ODBC Driver 18 for SQL Server")
    elif DB_DRIVER == "ODBC Driver 18 for SQL Server":
        drivers_to_try.append("ODBC Driver 17 for SQL Server")

    last_err = None
    for drv in drivers_to_try:
        try:
            conn_str = (
                f"DRIVER={{{drv}}};SERVER={DB_HOST};DATABASE={server_db};"
                f"UID={DB_USER};PWD={DB_PASS};{EXTRA_PARAMS}"
            )
            print(f"🔌 Conectando a {server_db} con {drv} ...")
            conn = pyodbc.connect(conn_str, autocommit=True)
            print("✅ Conectado")
            return conn
        except Exception as e:
            print(f"⚠️  No se pudo conectar con {drv}: {e}")
            last_err = e
    raise last_err

def exec_sql(conn, sql, ignore_errors=False):
    cur = conn.cursor()
    try:
        cur.execute(sql)
        try:
            _ = cur.fetchall()
        except:
            pass
    except Exception as e:
        if not ignore_errors:
            print("❌ Error ejecutando SQL:\n", sql)
            raise
        else:
            print(f"⚠️  Error ignorado: {e}")
    finally:
        cur.close()

def create_database():
    conn = connect_to("master")
    print(f"🗄️  Verificando existencia de BD '{DB_NAME}' ...")
    sql = dedent(f"""
        IF DB_ID('{DB_NAME}') IS NULL
        BEGIN
          PRINT 'Creando base de datos {DB_NAME} ...';
          CREATE DATABASE [{DB_NAME}];
        END
        ELSE
        BEGIN
          PRINT 'BD {DB_NAME} ya existe.';
        END
    """)
    exec_sql(conn, sql)
    conn.close()

def create_schema():
    conn = connect_to(DB_NAME)

    # 1) Tablas base (si no existen)
    print("📦 Creando tablas si no existen...")

    create_maquinaria = dedent("""
        IF OBJECT_ID('dbo.Maquinaria', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.Maquinaria (
              id INT IDENTITY(1,1) PRIMARY KEY,
              marca NVARCHAR(50) NOT NULL,
              modelo NVARCHAR(50) NOT NULL,
              serie NVARCHAR(50) NOT NULL UNIQUE,
              altura DECIMAL(5,2) NULL,
              estado NVARCHAR(20) NOT NULL DEFAULT 'Disponible'
          );
          PRINT 'Tabla Maquinaria creada';
        END
        ELSE
        BEGIN
          PRINT 'Tabla Maquinaria ya existe';
        END
    """)
    exec_sql(conn, create_maquinaria)

    create_cliente = dedent("""
        IF OBJECT_ID('dbo.Cliente', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.Cliente (
              id INT IDENTITY(1,1) PRIMARY KEY,
              razon_social NVARCHAR(100) NOT NULL,
              rut NVARCHAR(20) NOT NULL UNIQUE,
              direccion NVARCHAR(200) NULL,
              telefono NVARCHAR(20) NULL,
              forma_pago NVARCHAR(50) NULL
          );
          PRINT 'Tabla Cliente creada';
        END
        ELSE
        BEGIN
          PRINT 'Tabla Cliente ya existe';
        END
    """)
    exec_sql(conn, create_cliente)

    create_obra = dedent("""
        IF OBJECT_ID('dbo.Obra', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.Obra (
              id INT IDENTITY(1,1) PRIMARY KEY,
              nombre NVARCHAR(100) NOT NULL,
              direccion NVARCHAR(200) NULL,
              contacto_nombre NVARCHAR(100) NULL,
              contacto_telefono NVARCHAR(20) NULL,
              contacto_email NVARCHAR(100) NULL
          );
          PRINT 'Tabla Obra creada';
        END
        ELSE
        BEGIN
          PRINT 'Tabla Obra ya existe';
        END
    """)
    exec_sql(conn, create_obra)

    create_arriendo = dedent("""
        IF OBJECT_ID('dbo.Arriendo', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.Arriendo (
              id INT IDENTITY(1,1) PRIMARY KEY,
              maquinaria_id INT NOT NULL FOREIGN KEY REFERENCES dbo.Maquinaria(id),
              cliente_id   INT NOT NULL FOREIGN KEY REFERENCES dbo.Cliente(id),
              obra_id      INT NOT NULL FOREIGN KEY REFERENCES dbo.Obra(id),
              fecha_inicio DATE NOT NULL,
              fecha_termino DATE NULL,
              periodo NVARCHAR(20) NOT NULL CHECK (periodo IN ('Dia','Semana','Mes')),
              tarifa DECIMAL(10,2) NOT NULL,
              estado NVARCHAR(20) NOT NULL DEFAULT 'Activo'
          );
          PRINT 'Tabla Arriendo creada';
        END
        ELSE
        BEGIN
          PRINT 'Tabla Arriendo ya existe';
        END
    """)
    exec_sql(conn, create_arriendo)

    create_documento = dedent("""
        IF OBJECT_ID('dbo.Documento', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.Documento (
              id INT IDENTITY(1,1) PRIMARY KEY,
              arriendo_id INT NOT NULL FOREIGN KEY REFERENCES dbo.Arriendo(id),
              tipo NVARCHAR(30) NOT NULL CHECK (tipo IN ('Guia Despacho','Guia Retiro','Factura')),
              numero NVARCHAR(50) NOT NULL,
              fecha_emision DATE NOT NULL,
              archivo_url NVARCHAR(200) NULL
          );
          PRINT 'Tabla Documento creada';
        END
        ELSE
        BEGIN
          PRINT 'Tabla Documento ya existe';
        END
    """)
    exec_sql(conn, create_documento)

    # 2) Extensiones de Maquinaria para las 3 categorías
    print("🧩 Ampliando tabla Maquinaria (categoría y campos específicos)...")

    alters = [
        "IF COL_LENGTH('dbo.Maquinaria','categoria') IS NULL  ALTER TABLE dbo.Maquinaria ADD categoria NVARCHAR(30) NULL;",
        "IF COL_LENGTH('dbo.Maquinaria','descripcion') IS NULL ALTER TABLE dbo.Maquinaria ADD descripcion NVARCHAR(400) NULL;",
        "IF COL_LENGTH('dbo.Maquinaria','anio') IS NULL        ALTER TABLE dbo.Maquinaria ADD anio INT NULL;",
        "IF COL_LENGTH('dbo.Maquinaria','tonelaje') IS NULL    ALTER TABLE dbo.Maquinaria ADD tonelaje DECIMAL(7,2) NULL;",
        "IF COL_LENGTH('dbo.Maquinaria','carga') IS NULL       ALTER TABLE dbo.Maquinaria ADD carga DECIMAL(7,2) NULL;"
    ]
    for sql in alters:
        exec_sql(conn, sql)

    # 3) Constraints (en SQL dinámico para evitar error de compilación si las columnas se acaban de crear)
    print("🧷 Creando constraints si faltan...")

    ck_categoria = dedent("""
        IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Maquinaria_Categoria')
          EXEC('ALTER TABLE dbo.Maquinaria ADD CONSTRAINT CK_Maquinaria_Categoria
                CHECK (categoria IN (''equipos_altura'',''camiones'',''equipos_carga''))');
    """)
    exec_sql(conn, ck_categoria)

    ck_anio = dedent("""
        IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Maquinaria_Anio')
          EXEC('ALTER TABLE dbo.Maquinaria ADD CONSTRAINT CK_Maquinaria_Anio
                CHECK (anio IS NULL OR (anio BETWEEN 1980 AND 2100))');
    """)
    exec_sql(conn, ck_anio)

    # 4) Índices
    print("📚 Creando índices útiles...")

    ix_marca = dedent("""
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Maquinaria_marca' AND object_id = OBJECT_ID('dbo.Maquinaria'))
          CREATE INDEX IX_Maquinaria_marca  ON dbo.Maquinaria(marca);
    """)
    exec_sql(conn, ix_marca)

    ix_modelo = dedent("""
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Maquinaria_modelo' AND object_id = OBJECT_ID('dbo.Maquinaria'))
          CREATE INDEX IX_Maquinaria_modelo ON dbo.Maquinaria(modelo);
    """)
    exec_sql(conn, ix_modelo)

    conn.close()
    print("✅ Esquema creado/actualizado con éxito.")

if __name__ == "__main__":
    try:
        print("🚀 Iniciando creación de base de datos y esquema...")
        create_database()
        create_schema()
        print(f"🎉 Listo. Conecta tu Django con DB_NAME={DB_NAME} en {DB_HOST}.")
    except Exception as e:
        print("❌ Falló la instalación de la BD:", e)
        sys.exit(1)
