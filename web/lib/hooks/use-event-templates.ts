/**
 * Event Templates — localStorage-based template save/load (L4).
 *
 * Organizers can save event configurations as templates and load them
 * when creating new events. Templates are stored client-side.
 */
"use client";

export interface EventTemplate {
  id: string;
  name: string;
  data: {
    category: string;
    format: string;
    team_size_min: number;
    team_size_max: number;
    prize_pool_target: number | null;
    network_mode: string;
    description: string;
  };
  created_at: string;
}

const STORAGE_KEY = "sg-event-templates";

export function getTemplates(): EventTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTemplate(name: string, data: EventTemplate["data"]): EventTemplate {
  const templates = getTemplates();
  const template: EventTemplate = {
    id: crypto.randomUUID(),
    name,
    data,
    created_at: new Date().toISOString(),
  };
  templates.push(template);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  return template;
}

export function deleteTemplate(id: string): void {
  const templates = getTemplates().filter((t) => t.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function getTemplate(id: string): EventTemplate | undefined {
  return getTemplates().find((t) => t.id === id);
}
