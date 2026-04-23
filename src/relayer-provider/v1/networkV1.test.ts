import type { RelayerGetResponseKeyUrlSnakeCase } from '../types/private';
import { getKeysFromRelayer, _clearKeyurlCache } from './networkV1';
import { tfheCompactPkeCrsBytes, tfheCompactPublicKeyBytes } from '../../test';
import { SERIALIZED_SIZE_LIMIT_PK } from '../../sdk/lowlevel/constants';
import fetchMock from 'fetch-mock';
import { TEST_CONFIG } from '../../test/config';

////////////////////////////////////////////////////////////////////////////////
//
// Jest Command line
// =================
//
// npx jest --colors --passWithNoTests ./src/relayer-provider/v1/networkV1.test.ts
// npx jest --colors --passWithNoTests --coverage ./src/relayer-provider/v1/networkV1.test.ts --collectCoverageFrom=./src/relayer-provider/v1/networkV1.ts --testNamePattern=xxx
// npx jest --colors --passWithNoTests --coverage ./src/relayer-provider/v1/networkV1.test.ts --collectCoverageFrom=./src/relayer-provider/v1/networkV1.ts
//
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
//
// Old Payload Format:
// ===================
//
// const payload = {
//   response: {
//     crs: {
//       '2048': {
//         data_id: 'd8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
//         param_choice: 1,
//         signatures: ['0d13...', '4250...', 'a42c...', 'fhb5...'],
//         urls: [
//           'https://s3.amazonaws.com/bucket-name-1/PUB-p1/CRS/d8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
//           'https://s3.amazonaws.com/bucket-name-4/PUB-p4/CRS/d8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
//           'https://s3.amazonaws.com/bucket-name-2/PUB-p2/CRS/d8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
//           'https://s3.amazonaws.com/bucket-name-3/PUB-p3/CRS/d8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
//         ],
//       },
//     },
//     fhe_key_info: [
//       {
//         fhe_public_key: {
//           data_id: '408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//           param_choice: 1,
//           signatures: ['cdff...', '123c...', '00ff...', 'a367...'],
//           urls: [
//             'https://s3.amazonaws.com/bucket-name-1/PUB-p1/PublicKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//             'https://s3.amazonaws.com/bucket-name-4/PUB-p4/PublicKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//             'https://s3.amazonaws.com/bucket-name-2/PUB-p2/PublicKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//             'https://s3.amazonaws.com/bucket-name-3/PUB-p3/PublicKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//           ],
//         },
//         fhe_server_key: {
//           data_id: '408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//           param_choice: 1,
//           signatures: ['839b...', 'baef...', '55cc...', '81a4...'],
//           urls: [
//             'https://s3.amazonaws.com/bucket-name-1/PUB-p1/ServerKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//             'https://s3.amazonaws.com/bucket-name-4/PUB-p4/ServerKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//             'https://s3.amazonaws.com/bucket-name-2/PUB-p2/ServerKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//             'https://s3.amazonaws.com/bucket-name-3/PUB-p3/ServerKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//           ],
//         },
//       },
//     ],
//     verf_public_key: [
//       {
//         key_id: '408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//         server_id: 1,
//         verf_public_key_address:
//           'https://s3.amazonaws.com/bucket-name-1/PUB-p1/VerfAddress/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//         verf_public_key_url:
//           'https://s3.amazonaws.com/bucket-name-1/PUB-p1/VerfKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//       },
//       {
//         key_id: '408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//         server_id: 4,
//         verf_public_key_address:
//           'https://s3.amazonaws.com/bucket-name-4/PUB-p4/VerfAddress/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//         verf_public_key_url:
//           'https://s3.amazonaws.com/bucket-name-4//PUB-p4/VerfKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//       },
//       {
//         key_id: '408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//         server_id: 2,
//         verf_public_key_address:
//           'https://s3.amazonaws.com/bucket-name-2/PUB-p2/VerfAddress/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//         verf_public_key_url:
//           'https://s3.amazonaws.com/bucket-name-2/PUB-p2/VerfKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//       },
//       {
//         key_id: '408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//         server_id: 3,
//         verf_public_key_address:
//           'https://s3.amazonaws.com/bucket-name-3/PUB-p3/VerfAddress/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//         verf_public_key_url:
//           'https://s3.amazonaws.com/bucket-name-3/PUB-p3/VerfKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
//       },
//     ],
//   },
//   status: 'success',
// };
//
////////////////////////////////////////////////////////////////////////////////

const payload: RelayerGetResponseKeyUrlSnakeCase = {
  response: {
    crs: {
      '2048': {
        data_id: 'd8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
        urls: [
          'https://s3.amazonaws.com/bucket-name-1/PUB-p1/CRS/d8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
          'https://s3.amazonaws.com/bucket-name-4/PUB-p4/CRS/d8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
          'https://s3.amazonaws.com/bucket-name-2/PUB-p2/CRS/d8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
          'https://s3.amazonaws.com/bucket-name-3/PUB-p3/CRS/d8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
        ],
      },
    },
    fhe_key_info: [
      {
        fhe_public_key: {
          data_id: '408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
          urls: [
            'https://s3.amazonaws.com/bucket-name-1/PUB-p1/PublicKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
            'https://s3.amazonaws.com/bucket-name-4/PUB-p4/PublicKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
            'https://s3.amazonaws.com/bucket-name-2/PUB-p2/PublicKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
            'https://s3.amazonaws.com/bucket-name-3/PUB-p3/PublicKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
          ],
        },
      },
    ],
  },
};

const describeIfFetchMock =
  TEST_CONFIG.type === 'fetch-mock' ? describe : describe.skip;

const pubKeyUrl = payload.response.fhe_key_info[0].fhe_public_key.urls[0];
const crsUrl = payload.response.crs['2048'].urls[0];

////////////////////////////////////////////////////////////////////////////////

describeIfFetchMock('network', () => {
  beforeEach(() => {
    _clearKeyurlCache();
    fetchMock.removeRoutes();
  });

  afterEach(() => {
    _clearKeyurlCache();
    fetchMock.removeRoutes();
  });

  it('getKeysFromRelayer', async () => {
    fetchMock.get('https://test-relayer.net/v1/keyurl', payload);

    fetchMock.get(
      'https://s3.amazonaws.com/bucket-name-1/PUB-p1/PublicKey/408d8cbaa51dece7f782fe04ba0b1c1d017b1088',
      tfheCompactPublicKeyBytes,
    );

    fetchMock.get(
      'https://s3.amazonaws.com/bucket-name-1/PUB-p1/CRS/d8d94eb3a23d22d3eb6b5e7b694e8afcd571d906',
      tfheCompactPkeCrsBytes,
    );

    const material = await getKeysFromRelayer('https://test-relayer.net/v1');

    expect(
      material.publicKey.safe_serialize(SERIALIZED_SIZE_LIMIT_PK),
    ).toStrictEqual(tfheCompactPublicKeyBytes);
  });

  it('cache hit: second call returns same object, /keyurl called once', async () => {
    let keyurlCallCount = 0;
    fetchMock.get(TEST_CONFIG.v1.urls.keyUrl, () => {
      keyurlCallCount++;
      return payload;
    });
    fetchMock.get(pubKeyUrl, tfheCompactPublicKeyBytes);
    fetchMock.get(crsUrl, tfheCompactPkeCrsBytes);

    const r1 = await getKeysFromRelayer(TEST_CONFIG.v1.urls.base);
    const r2 = await getKeysFromRelayer(TEST_CONFIG.v1.urls.base);

    expect(r1).toBe(r2);
    expect(keyurlCallCount).toBe(1);
  });

  it('FIFO eviction: 17th URL evicts url-00', async () => {
    const keyurlCallCounts: number[] = new Array(17).fill(0) as number[];

    // Asset mocks registered once — all 17 payloads reference the same asset URLs
    fetchMock.get(pubKeyUrl, tfheCompactPublicKeyBytes);
    fetchMock.get(crsUrl, tfheCompactPkeCrsBytes);

    // Register 17 unique keyurl mocks
    for (let n = 0; n < 17; n++) {
      const idx = n;
      fetchMock.get(
        `https://test-relayer.net/url-${String(idx).padStart(2, '0')}/keyurl`,
        () => {
          keyurlCallCounts[idx]++;
          return payload;
        },
      );
    }

    // Fill cache with url-00..url-15 (16 entries)
    for (let n = 0; n < 16; n++) {
      await getKeysFromRelayer(
        `https://test-relayer.net/url-${String(n).padStart(2, '0')}`,
      );
    }

    // Insert url-16 — evicts url-00
    await getKeysFromRelayer('https://test-relayer.net/url-16');

    // url-01 is still in cache (only url-00 was evicted)
    await getKeysFromRelayer('https://test-relayer.net/url-01');
    expect(keyurlCallCounts[1]).toBe(1);

    // Re-fetch url-00 — was evicted, must hit network again
    await getKeysFromRelayer('https://test-relayer.net/url-00');
    expect(keyurlCallCounts[0]).toBe(2);
  });
});
