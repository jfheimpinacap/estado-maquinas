// src/components/layout/AdminLayout.jsx
export default function AdminLayout({ title, breadcrumbs, actions, children }) {
  return (
    <>
      {(title || breadcrumbs || actions) && (
        <header className="page-header" style={{ marginBottom: 12 }}>
          {title && <h1 className="page-title">{title}</h1>}
          {breadcrumbs && <div className="breadcrumbs">{breadcrumbs}</div>}
          {actions && <div className="actions-bar">{actions}</div>}
        </header>
      )}
      {children}
    </>
  );
}

