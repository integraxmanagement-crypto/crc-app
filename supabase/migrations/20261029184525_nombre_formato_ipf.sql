-- Nombre del formato IPF según el modelo del dueño (Inspección de Seguridad Ocupacional, 29/10/2026): base y copias de las empresas.
update public.plantillas set nombre = 'Inspección de seguridad ocupacional (IPF)', actualizado_en = now() where codigo = 'ipf' and nombre = 'IPF · Inspección programada focalizada';
update public.plantillas p set nombre = 'Inspección de seguridad ocupacional (IPF)', actualizado_en = now()
  from public.plantillas b where p.base_id = b.id and b.empresa_id is null and b.codigo = 'ipf' and p.nombre = 'IPF · Inspección programada focalizada';
