export const EXISTING_REPO = {
  name: 'react',
  owner: 'facebook',
};

export const NON_EXISTING_REPO = {
  name: 'i-dont-exist',
  owner: 'facebook',
};

export type ReleaseFixture = {
  tag: string;
  name: string;
  publishedAt: string;
};

export const INITIAL_RELEASE: ReleaseFixture = {
  tag: 'v18.2.0',
  name: 'v18.2.0',
  publishedAt: '2022-06-14T17:15:21Z',
};

export const NEW_RELEASE: ReleaseFixture = {
  tag: 'v19.0.0',
  name: 'v19.0.0',
  publishedAt: '2026-07-05T12:00:00Z',
};
