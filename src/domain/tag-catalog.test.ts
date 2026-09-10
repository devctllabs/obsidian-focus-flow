import { describe, expect, it } from 'vitest';
import { parseTagCatalog, updateTagCatalog } from './tag-catalog';

const note = '---\nowner: me\nfocus_flow:\n  schema_version: 1\n  type: tag_catalog\n  tags:\n    " #area/focus ":\n      description: " Sustained attention "\n      color: "#6750a4"\n    weekly-review: {}\n    broken-entry: red\n    broken-fields:\n      description: ""\n      color: red\n---\nProject **tag guidance**.\n';

describe('Workspace Tag Catalog', () => {
  it('is optional, exact, case sensitive, and isolates invalid entries and fields', () => {
    expect(parseTagCatalog(null)).toEqual({ entries: {}, diagnostics: [] });
    const catalog = parseTagCatalog(note);
    expect(catalog.entries).toEqual({
      'area/focus': { description: 'Sustained attention', color: '#6750A4' },
      'weekly-review': {},
      'broken-fields': {},
    });
    expect(catalog.entries['area/focus/child']).toBeUndefined();
    expect(catalog.entries['Area/focus']).toBeUndefined();
    expect(catalog.diagnostics).toEqual([
      expect.stringContaining('#broken-entry'),
      expect.stringContaining('Description for #broken-fields'),
      expect.stringContaining('Color for #broken-fields'),
    ]);
  });

  it('preserves the body and unrelated data while adding, editing, clearing, and removing entries', () => {
    const added = updateTagCatalog(note, '#context/home', {});
    const described = updateTagCatalog(added, 'context/home', { description: 'Home context', color: '#0f766e' });
    expect(described).toContain('owner: me');
    expect(described).toContain('Project **tag guidance**.\n');
    expect(parseTagCatalog(described).entries['context/home']).toEqual({ description: 'Home context', color: '#0F766E' });
    const cleared = updateTagCatalog(described, 'context/home', { description: null, color: null });
    expect(parseTagCatalog(cleared).entries['context/home']).toEqual({});
    expect(parseTagCatalog(updateTagCatalog(cleared, 'context/home', null)).entries['context/home']).toBeUndefined();
  });

  it('keeps valid siblings when normalized keys collide and refuses destructive updates of malformed YAML', () => {
    const duplicate = note.replace('    weekly-review: {}', '    weekly-review: {}\n    "#weekly-review": {}');
    const parsed = parseTagCatalog(duplicate);
    expect(parsed.entries['area/focus']).toEqual({ description: 'Sustained attention', color: '#6750A4' });
    expect(parsed.entries['weekly-review']).toBeUndefined();
    expect(parsed.diagnostics).toContainEqual(expect.stringContaining('#weekly-review'));
    expect(() => updateTagCatalog('not frontmatter', 'new', {})).toThrow('TAGS.md');
    expect(() => updateTagCatalog(null, 'new', { color: 'red' })).toThrow('six-digit');
    expect(() => updateTagCatalog(null, 'new', { description: '   ' })).toThrow('Description');
  });
});
