const crypto = require("crypto");

const CRYPTO_ALGORITHM = "aes-256-cbc";
const CRYPTO_INPUT_ENCODING = "utf8";
const CRYPTO_OUTPUT_ENCODING = "base64";

// TODO integrate with key store API
const secrets = new class {
  secret: string = "this_is_a_hard_coded_secret"; // replace with unique key or use API for external key store with logging

  getSecret(): string {
    return this.secret;
  }
}();

// encrypt data at rest!
export abstract class EncryptableData<T> {
  // TODO crypto.createCipher is deprecated -- move to crypto.createCipheriv

  constructor(data = null, recordSecret: string = "") {
    if (typeof data === "string") {
      var decipher = crypto.createDecipher(
        CRYPTO_ALGORITHM,
        secrets.getSecret() + recordSecret
      );
      var decryptedText = decipher.update(
        data,
        CRYPTO_OUTPUT_ENCODING,
        CRYPTO_INPUT_ENCODING
      );
      decryptedText += decipher.final(CRYPTO_INPUT_ENCODING);

      var obj = JSON.parse(decryptedText);

      // TODO type checking/validation on decrypted objects

      Object.assign(this, obj);
    }
  }

  encrypt(): string {
    var text = JSON.stringify(this);

    var cipher = crypto.createCipher(
      CRYPTO_ALGORITHM,
      secrets.getSecret() + this.getRecordSecret()
    );
    var encryptedText = cipher.update(
      text,
      CRYPTO_INPUT_ENCODING,
      CRYPTO_OUTPUT_ENCODING
    );
    encryptedText += cipher.final(CRYPTO_OUTPUT_ENCODING);

    return encryptedText;
  }

  // recordSecret lets us use data from the record itself to ensure that no one can read the archived data without already having access
  // to unencrypted data from the same source. By default we're using provider supplied "device_id" as part of the encryption key --
  // the only way to get find that is to query the MDS API and get another *unencrypted* id from the same device.
  abstract getRecordSecret(): string;
}
