export type Photo = {
  id: string; name: string; description?: string; alt?: string; tags: string[];
  is360?: boolean; status?: string; source?: string; urls?: Record<string, string>;
  galleries?: { id: string; name: string }[];
};
export type Gallery = {
  id: string; name: string; desc?: string; status: string; ready: boolean;
  tags: string[]; hasPassword?: boolean; featuredPhoto?: Photo; photos?: Photo[];
  subGalleries?: Gallery[]; parentId?: string; eventDate?: string; uploadedAt?: string;
};

// Keep only the metadata used by the interface. Never retain gallery passwords.
export function normalizePhoto(p: any): Photo {
  return {
    id: p.id, name: p.name || '', description: p.description, alt: p.alt,
    tags: Array.isArray(p.tags) ? p.tags : [], is360: p.is360, status: p.status,
    source: p.source, urls: p.urls,
    galleries: p.galleries?.map((g: any) => ({ id: g.id, name: g.name })),
  };
}

export function normalizeGallery(g: any, parentId?: string): Gallery {
  const hasPassword = typeof g.hasPassword === 'boolean' ? g.hasPassword
    : Object.hasOwn(g, 'password') ? typeof g.password === 'string' && !!g.password.trim()
    : undefined;
  return {
    id: g.id, name: g.name || '', desc: g.desc, status: g.status, ready: !!g.ready,
    tags: Array.isArray(g.tags) ? g.tags : [], hasPassword,
    parentId: g.parentGallery?.id || g.parentId || parentId || undefined,
    eventDate: g.eventDate, uploadedAt: g.uploadedAt,
    featuredPhoto: g.featuredPhoto ? normalizePhoto(g.featuredPhoto) : undefined,
    photos: g.photos?.map(normalizePhoto),
    subGalleries: g.subGalleries?.map((child: any) => normalizeGallery(child, g.id)),
  };
}

export function normalizeGalleryList(value: unknown): Gallery[] {
  if (!Array.isArray(value)) throw new Error('La liste des galeries est invalide.');
  const result = new Map<string, Gallery>();
  function visit(g: Gallery) {
    const previous = result.get(g.id);
    result.set(g.id, { ...previous, ...g, parentId: g.parentId || previous?.parentId,
      hasPassword: g.hasPassword ?? previous?.hasPassword });
    for (const child of g.subGalleries || []) visit(child);
  }
  for (const g of value) visit(normalizeGallery(g));
  return [...result.values()];
}
