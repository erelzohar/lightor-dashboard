import { describe, it, expect } from 'vitest';
import {
  reconcileAppointmentTypes,
  removedStoredImages,
  storedImageName,
} from '../../utils/aiReconcile';
import type { AppointmentType } from '../../types';

const IMAGES_BASE = 'https://api.lightor.app/api/images/';

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

describe('storedImageName', () => {
  it('returns a bare S3 imageName as-is', () => {
    expect(storedImageName('1690000000000-abc.webp', IMAGES_BASE)).toBe('1690000000000-abc.webp');
  });
  it('extracts the imageName from a full url to our images endpoint', () => {
    expect(storedImageName(`${IMAGES_BASE}1690-abc.webp`, IMAGES_BASE)).toBe('1690-abc.webp');
  });
  it('still resolves our prod url when running against another host', () => {
    // Stored value is a prod url; app configured with a dev base.
    expect(storedImageName('https://api.lightor.app/api/images/x.webp', 'http://localhost:3000/api/images/'))
      .toBe('x.webp');
  });
  it('drops query/hash and decodes', () => {
    expect(storedImageName(`${IMAGES_BASE}a%20b.webp?v=2`, IMAGES_BASE)).toBe('a b.webp');
  });
  it('returns null for external / data / blob refs and empties', () => {
    expect(storedImageName('https://picsum.photos/seed/x/800/600', IMAGES_BASE)).toBeNull();
    expect(storedImageName('https://scontent.cdninstagram.com/a.jpg', IMAGES_BASE)).toBeNull();
    expect(storedImageName('data:image/png;base64,AAAA', IMAGES_BASE)).toBeNull();
    expect(storedImageName('blob:http://localhost/uuid', IMAGES_BASE)).toBeNull();
    expect(storedImageName('', IMAGES_BASE)).toBeNull();
    expect(storedImageName(undefined, IMAGES_BASE)).toBeNull();
  });
});

describe('removedStoredImages', () => {
  it('returns only our removed uploads, never external urls', () => {
    const original = ['up1.webp', 'https://picsum.photos/x', 'up2.webp'];
    const draft = ['up2.webp']; // up1 removed, picsum removed
    // up1.webp is ours and gone → delete. picsum is external → ignore.
    expect(removedStoredImages(original, draft, IMAGES_BASE)).toEqual(['up1.webp']);
  });

  it('does not delete an upload kept under a different ref shape', () => {
    // Removed as a bare name, but still referenced as a full url → must survive.
    const original = ['dup.webp'];
    const draft = [`${IMAGES_BASE}dup.webp`];
    expect(removedStoredImages(original, draft, IMAGES_BASE)).toEqual([]);
  });

  it('does not delete an upload still used elsewhere in the gallery', () => {
    expect(removedStoredImages(['dup.webp', 'dup.webp'], ['dup.webp'], IMAGES_BASE)).toEqual([]);
  });

  it('deletes every upload when the gallery is cleared', () => {
    expect(removedStoredImages(['a.webp', 'b.webp'], [], IMAGES_BASE)).toEqual(['a.webp', 'b.webp']);
  });

  it('deletes our image even when it was stored as a full url', () => {
    const original = [`${IMAGES_BASE}gone.webp`];
    expect(removedStoredImages(original, [], IMAGES_BASE)).toEqual(['gone.webp']);
  });
});
