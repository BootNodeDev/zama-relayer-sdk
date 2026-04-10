import type { RelayerPublicDecryptPayload } from '../relayer-provider/types/public-api';
import type { KmsContextCache } from '../sdk/kms/KmsContextCache';
import type { ClearValues } from '../types/relayer';
import { publicDecryptRequest, abiEncodeClearValues } from './publicDecrypt';
import { FhevmHandle } from '@sdk/FhevmHandle';
import fetchMock from 'fetch-mock';
import { ethers } from 'ethers';
import { getErrorCause, getErrorCauseErrorMessage } from './error';
import { createRelayerProvider } from '../relayer-provider/createRelayerProvider';
import { TEST_CONFIG, TEST_KMS } from '../test/config';
import { fetchRelayerV1Post } from '../relayer-provider/v1/fetchRelayerV1';
import { ChecksummedAddress } from 'src/node';

// Mock KmsContextCache that returns init-time signers (legacy behavior)
const mockKmsContextCache = {
  getCurrentContextId: jest.fn().mockResolvedValue(0n),
  getSignersForContext: jest.fn().mockResolvedValue(TEST_KMS.addresses),
} as unknown as KmsContextCache;

// Jest Command line
// =================
// npx jest --colors --passWithNoTests ./src/relayer/publicDecrypt.test.ts
// npx jest --colors --passWithNoTests --coverage ./src/relayer/publicDecrypt.test.ts --collectCoverageFrom=./src/relayer/publicDecrypt.ts --testNamePattern=xxx
// npx jest --colors --passWithNoTests --coverage ./src/relayer/publicDecrypt.test.ts --collectCoverageFrom=./src/relayer/publicDecrypt.ts

const relayerProvider = createRelayerProvider('https://test-fhevm-relayer');
const RELAYER_PUBLIC_DECRYPT_URL = relayerProvider.publicDecryptUrl;

const dummyRelayerUserDecryptPayload: RelayerPublicDecryptPayload = {
  ciphertextHandles: ['0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'],
  extraData: '0x00',
};

const describeIfFetchMock =
  TEST_CONFIG.type === 'fetch-mock' ? describe : describe.skip;

describeIfFetchMock('publicDecrypt', () => {
  beforeEach(() => {
    fetchMock.removeRoutes();
  });

  it('relayerProvider', async () => {
    expect(relayerProvider.version).toStrictEqual(2);
    expect(relayerProvider.url).toStrictEqual('https://test-fhevm-relayer');
    expect(RELAYER_PUBLIC_DECRYPT_URL).toStrictEqual(
      'https://test-fhevm-relayer/public-decrypt',
    );
  });

  it('get public decryption for handle', async () => {
    fetchMock.post(RELAYER_PUBLIC_DECRYPT_URL, {
      status: 'success',
      response: {},
    });

    publicDecryptRequest({
      kmsSigners: TEST_KMS.addresses,
      thresholdSigners: TEST_KMS.kmsSignerThreshold,
      gatewayChainId: TEST_CONFIG.fhevmInstanceConfig.gatewayChainId,
      verifyingContractAddressDecryption: TEST_CONFIG.fhevmInstanceConfig
        .verifyingContractAddressDecryption as ChecksummedAddress,
      aclContractAddress: TEST_CONFIG.fhevmInstanceConfig
        .aclContractAddress as ChecksummedAddress,
      relayerProvider,
      provider: new ethers.JsonRpcProvider('https://devnet.zama.ai'),
      kmsContextCache: mockKmsContextCache,
    });
  });
});

describeIfFetchMock('fetchRelayerPublicDecrypt', () => {
  beforeEach(() => {
    fetchMock.removeRoutes();
  });

  it('error: response.ok === false', async () => {
    const response = new Response('Forbidden', {
      status: 403,
      statusText: 'Forbidden',
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    fetchMock.postOnce(RELAYER_PUBLIC_DECRYPT_URL, response);

    try {
      await fetchRelayerV1Post(
        'PUBLIC_DECRYPT',
        RELAYER_PUBLIC_DECRYPT_URL,
        dummyRelayerUserDecryptPayload,
      );
    } catch (e) {
      expect(String(e)).toBe(
        'Error: Public decrypt failed: relayer respond with HTTP code 403',
      );
      const cause = getErrorCause(e);

      const c = cause as any;
      expect(c).toEqual(
        expect.objectContaining({
          code: 'RELAYER_FETCH_ERROR',
          operation: 'PUBLIC_DECRYPT',
          status: 403,
          statusText: 'Forbidden',
          url: RELAYER_PUBLIC_DECRYPT_URL,
          responseJson: '',
        }),
      );
      expect(c.response).toEqual(
        expect.objectContaining({
          status: 403,
          statusText: 'Forbidden',
          ok: false,
        }),
      );
    }
  });

  it('error: response.status === 429', async () => {
    const response = new Response('Rate Limit', {
      status: 429,
      statusText: 'Rate Limit',
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    fetchMock.postOnce(RELAYER_PUBLIC_DECRYPT_URL, response);

    try {
      await fetchRelayerV1Post(
        'PUBLIC_DECRYPT',
        RELAYER_PUBLIC_DECRYPT_URL,
        dummyRelayerUserDecryptPayload,
      );
    } catch (e) {
      expect(String(e)).toBe(
        'Error: Relayer rate limit exceeded: Please wait and try again later.',
      );
      const cause = getErrorCause(e);

      const c = cause as any;
      expect(c).toEqual(
        expect.objectContaining({
          code: 'RELAYER_FETCH_ERROR',
          operation: 'PUBLIC_DECRYPT',
          status: 429,
          statusText: 'Rate Limit',
          url: RELAYER_PUBLIC_DECRYPT_URL,
          responseJson: '',
        }),
      );
      // For some reason, `expect.objectContaining` does not work in this specific situation.
      expect(c.response.status).toEqual(429);
      expect(c.response.statusText).toEqual('Rate Limit');
      expect(c.response.ok).toEqual(false);
      expect(c.response.url).toEqual(RELAYER_PUBLIC_DECRYPT_URL);
    }
  });

  it('error: fetch throws an error', async () => {
    const errorToThrow = new Error();
    fetchMock.post('https://test-fhevm-relayer/v1/public-decrypt', {
      throws: errorToThrow,
    });

    try {
      await fetchRelayerV1Post(
        'PUBLIC_DECRYPT',
        'https://test-fhevm-relayer/v1/public-decrypt',
        dummyRelayerUserDecryptPayload,
      );
    } catch (e) {
      expect(String(e)).toBe(
        "Error: Public decrypt failed: Relayer didn't respond",
      );
      const cause = getErrorCause(e);
      expect(cause).toEqual({
        code: 'RELAYER_UNKNOWN_ERROR',
        operation: 'PUBLIC_DECRYPT',
        error: errorToThrow,
      });
    }
  });

  it('error: no json', async () => {
    fetchMock.postOnce(RELAYER_PUBLIC_DECRYPT_URL, () => {
      return 'DeadBeef';
    });

    try {
      await fetchRelayerV1Post(
        'PUBLIC_DECRYPT',
        RELAYER_PUBLIC_DECRYPT_URL,
        dummyRelayerUserDecryptPayload,
      );
    } catch (e) {
      expect(String(e)).toBe(
        "Error: Public decrypt failed: Relayer didn't return a JSON",
      );
      const cause = getErrorCause(e);
      const c = cause as any;

      expect(c.code).toEqual('RELAYER_NO_JSON_ERROR');
      expect(c.operation).toEqual('PUBLIC_DECRYPT');

      const msg = 'Unexpected token \'D\', "DeadBeef" is not valid JSON';

      expect(c.error.message).toEqual(msg);
      expect(String(getErrorCauseErrorMessage(e))).toBe(msg);
    }
  });

  it('error: unexpected json', async () => {
    fetchMock.postOnce(RELAYER_PUBLIC_DECRYPT_URL, {
      status: 'failure',
      dummy: 'This is a dummy error',
    });

    try {
      await fetchRelayerV1Post(
        'PUBLIC_DECRYPT',
        RELAYER_PUBLIC_DECRYPT_URL,
        dummyRelayerUserDecryptPayload,
      );
    } catch (e) {
      expect(String(e)).toBe(
        'Error: Public decrypt failed: Relayer returned an unexpected JSON response',
      );
      const cause = getErrorCause(e);

      const c = cause as any;

      expect(c.code).toEqual('RELAYER_UNEXPECTED_JSON_ERROR');
      expect(c.operation).toEqual('PUBLIC_DECRYPT');

      const msg =
        "Unexpected response JSON format: missing 'response' property.";

      expect(c.error.message).toEqual(msg);
      expect(String(getErrorCauseErrorMessage(e))).toBe(msg);
    }
  });

  it('succeeded', async () => {
    fetchMock.postOnce(RELAYER_PUBLIC_DECRYPT_URL, {
      response: {},
    });
    await fetchRelayerV1Post(
      'PUBLIC_DECRYPT',
      RELAYER_PUBLIC_DECRYPT_URL,
      dummyRelayerUserDecryptPayload,
    );
  });
});

////////////////////////////////////////////////////////////////////////////////
// abiEncodeClearValues unit tests
////////////////////////////////////////////////////////////////////////////////

function makeHandle(
  fheTypeId: 0 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
): FhevmHandle {
  const hash21 = `0x${'ab'.repeat(21).slice(0, 42)}` as `0x${string}`;
  return FhevmHandle.fromComponents({
    hash21,
    chainId: 9000,
    fheTypeId,
    version: 0,
    computed: false,
    index: 0,
  });
}

describe('abiEncodeClearValues', () => {
  it('ebool: true encodes to abiValues[0] === 1n', () => {
    const handle = makeHandle(0);
    const hex = handle.toBytes32Hex();
    const { abiTypes, abiValues } = abiEncodeClearValues(
      [hex],
      { [hex]: true } as ClearValues,
    );
    expect(abiTypes).toStrictEqual(['uint256']);
    expect(abiValues[0]).toBe(1n);
  });

  it('ebool: false encodes to abiValues[0] === 0n', () => {
    const handle = makeHandle(0);
    const hex = handle.toBytes32Hex();
    const { abiTypes, abiValues } = abiEncodeClearValues(
      [hex],
      { [hex]: false } as ClearValues,
    );
    expect(abiTypes).toStrictEqual(['uint256']);
    expect(abiValues[0]).toBe(0n);
  });

  it('ebool: non-boolean value 2n throws', () => {
    const handle = makeHandle(0);
    const hex = handle.toBytes32Hex();
    expect(() =>
      abiEncodeClearValues([hex], { [hex]: 2n } as ClearValues),
    ).toThrow('Invalid ebool clear text value 2. Expecting 0 or 1.');
  });

  it('eaddress: address bigint encodes to 40-char hex string in abiValues', () => {
    const handle = makeHandle(7);
    const hex = handle.toBytes32Hex();
    const addressBigInt = BigInt('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
    const { abiTypes, abiValues } = abiEncodeClearValues(
      [hex],
      { [hex]: addressBigInt } as ClearValues,
    );
    expect(abiTypes).toStrictEqual(['uint256']);
    expect(abiValues[0]).toBe('0xd8da6bf26964af9d7eed9e03e53415d37aa96045');
  });

  it('euint32: bigint value 42n passes through as-is', () => {
    const handle = makeHandle(4);
    const hex = handle.toBytes32Hex();
    const { abiTypes, abiValues } = abiEncodeClearValues(
      [hex],
      { [hex]: 42n } as ClearValues,
    );
    expect(abiTypes).toStrictEqual(['uint256']);
    expect(abiValues[0]).toBe(42n);
  });
});
