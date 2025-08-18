-- ========================================
-- 1. Tabla: Maquinaria
-- ========================================
CREATE TABLE Maquinaria (
    id INT IDENTITY(1,1) PRIMARY KEY,
    marca NVARCHAR(50) NOT NULL,
    modelo NVARCHAR(50) NOT NULL,
    serie NVARCHAR(50) UNIQUE NOT NULL,
    altura DECIMAL(5,2),
    estado NVARCHAR(20) NOT NULL DEFAULT 'Disponible'
);

-- ========================================
-- 2. Tabla: Cliente
-- ========================================
CREATE TABLE Cliente (
    id INT IDENTITY(1,1) PRIMARY KEY,
    razon_social NVARCHAR(100) NOT NULL,
    rut NVARCHAR(20) NOT NULL UNIQUE,
    direccion NVARCHAR(200),
    telefono NVARCHAR(20),
    forma_pago NVARCHAR(50)
);

-- ========================================
-- 3. Tabla: Obra
-- ========================================
CREATE TABLE Obra (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    direccion NVARCHAR(200),
    contacto_nombre NVARCHAR(100),
    contacto_telefono NVARCHAR(20),
    contacto_email NVARCHAR(100)
);

-- ========================================
-- 4. Tabla: Arriendo
-- ========================================
CREATE TABLE Arriendo (
    id INT IDENTITY(1,1) PRIMARY KEY,
    maquinaria_id INT NOT NULL FOREIGN KEY REFERENCES Maquinaria(id),
    cliente_id INT NOT NULL FOREIGN KEY REFERENCES Cliente(id),
    obra_id INT NOT NULL FOREIGN KEY REFERENCES Obra(id),
    fecha_inicio DATE NOT NULL,
    fecha_termino DATE,
    periodo NVARCHAR(20) NOT NULL CHECK (periodo IN ('Dia', 'Semana', 'Mes')),
    tarifa DECIMAL(10,2) NOT NULL,
    estado NVARCHAR(20) NOT NULL DEFAULT 'Activo'
);

-- ========================================
-- 5. Tabla: Documento
-- ========================================
CREATE TABLE Documento (
    id INT IDENTITY(1,1) PRIMARY KEY,
    arriendo_id INT NOT NULL FOREIGN KEY REFERENCES Arriendo(id),
    tipo NVARCHAR(30) NOT NULL CHECK (tipo IN ('Guia Despacho', 'Guia Retiro', 'Factura')),
    numero NVARCHAR(50) NOT NULL,
    fecha_emision DATE NOT NULL,
    archivo_url NVARCHAR(200)
);

ALTER LOGIN sa ENABLE;
ALTER LOGIN sa WITH PASSWORD = 'Franz2024!';


