import { describe, it, expect } from 'vitest';
import {
  reconcileAppointmentTypes,
  removedStoredImages,
  isStoredImage,
} from '../../utils/aiReconcile';
import type { AppointmentType } from '../../types';

const type = (over: Partial<AppointmentType>): AppointmentType => ({
  _id: '',
  name: '',
  webConfig_id: 'w1',
  price: '0',
  durationMS: '0',
  ...over,
});

describe('reconcileAppointmentTypes', () => {
  it('updates a service whose id the server actually has', () => {
    const { toUpdate, toCreate, toDeleteIds } = reconcileAppointmentTypes(
      [type({ _id: 'real1', name: 'Haircut' })],
      [{ _id: 'real1' }]
    );
    expect(toUpdate.map((t) => t._id)).toEqual(['real1']);
    expect(toCreate).toHaveLength(0);
    expect(toDeleteIds).toHaveLength(0);
  });

  it('creates a service the AI invented with a fake but valid-looking id', () => {
    // 24-hex — passes the old isValidObjectId() guard, but is not a real id.
    const fake = '6a917754eb84fe0143e2f623';
    const { toCreate, toUpdate, toDeleteIds } = reconcileAppointmentTypes(
      [type({ _id: fake, name: 'Beard trim' })],
      [{ _id: 'real1' }]
    );
    expect(toCreate).toEqual([expect.objectContaining({ name: 'Beard trim' })]);
    expect(toCreate[0]).not.toHaveProperty('_id'); // stripped before POST
    expect(toUpdate).toHaveLength(0);
    // real1 was not in the draft → removed.
    expect(toDeleteIds).toEqual(['real1']);
  });

  it('deletes services the AI dropped from the edit', () => {
    const { toDeleteIds } = reconcileAppointmentTypes(
      [type({ _id: 'keep', name: 'Kept' })],
      [{ _id: 'keep' }, { _id: 'gone1' }, { _id: 'gone2' }]
    );
    expect(toDeleteIds.sort()).toEqual(['gone1', 'gone2']);
  });

  it('treats an explicitly empty draft as "remove all"', () => {
    const { toDeleteIds, toCreate, toUpdate } = reconcileAppointmentTypes(
      [],
      [{ _id: 'a' }, { _id: 'b' }]
    );
    expect(toDeleteIds.sort()).toEqual(['a', 'b']);
    expect(toCreate).toHaveLength(0);
    expect(toUpdate).toHaveLength(0);
  });

  it('creates all when the site had none yet', () => {
    const { toCreate, toDeleteIds } = reconcileAppointmentTypes(
      [type({ name: 'First' }), type({ name: 'Second' })],
      []
    );
    expect(toCreate).toHaveLength(2);
    expect(toDeleteIds).toHaveLength(0);
  });
});

describe('isStoredImage', () => {
  it('treats a bare S3 imageName as ours', () => {
    expect(isStoredImage('1690000000000-abc.webp')).toBe(true);
  });
  it('treats external / data / blob refs as not ours', () => {
    expect(isStoredImage('https://picsum.photos/seed/x/800/600')).toBe(false);
    expect(isStoredImage('http://example.com/a.jpg')).toBe(false);
    expect(isStoredImage('data:image/png;base64,AAAA')).toBe(false);
    expect(isStoredImage('blob:http://localhost/uuid')).toBe(false);
    expect(isStoredImage('')).toBe(false);
    expect(isStoredImage(undefined)).toBe(false);
  });
});

describe('removedStoredImages', () => {
  it('returns only our removed uploads, never external urls', () => {
    const original = ['up1.webp', 'https://picsum.photos/x', 'up2.webp'];
    const draft = ['up2.webp']; // up1 removed, picsum removed
    // up1.webp is ours and gone → delete. picsum is external → ignore.
    expect(removedStoredImages(original, draft)).toEqual(['up1.webp']);
  });

  it('does not delete an upload still used elsewhere in the gallery', () => {
    // Same image kept under a second item — must survive.
    expect(removedStoredImages(['dup.webp', 'dup.webp'], ['dup.webp'])).toEqual([]);
  });

  it('deletes every upload when the gallery is cleared', () => {
    expect(removedStoredImages(['a.webp', 'b.webp'], [])).toEqual(['a.webp', 'b.webp']);
  });
});
