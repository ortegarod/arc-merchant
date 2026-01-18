# Register Your Entity Secret

> Create an Entity Secret and register its ciphertext to enable developer-wallet features using the Circle Wallets SDK.

In this guide you will learn how to generate, encrypt, and register an
<Tooltip tip="A 32-byte private key that secures your developer-controlled wallets. Circle never stores it, so you are responsible for keeping it safe.">Entity Secret</Tooltip>
using the Circle SDK. The SDK simplifies your development process by securely handling encryption and registration.

## Prerequisites

1. Create a
   [Developer Account and acquire an API key in the Console](/w3s/circle-developer-account).
2. Install the applicable server-side SDK for your language:

   <Tabs>
     <Tab title="Node.js">
       Use the following commands to install the SDK. You can
       [view the package information on the npm site](https://www.npmjs.com/package/@circle-fin/developer-controlled-wallets).

       <CodeGroup>
         ```shell npm theme={null}
         npm install @circle-fin/developer-controlled-wallets --save
         ```

         ```shell yarn theme={null}
         yarn add @circle-fin/developer-controlled-wallets
         ```
       </CodeGroup>

       For more information, visit the
       [Node.js SDK](/sdks/developer-controlled-wallets-nodejs-sdk).
     </Tab>

     <Tab title="Python">
       Use the following command to install the SDK with
       [pip](https://pypi.org/project/pip/):

       ```shell  theme={null}
       pip install circle-developer-controlled-wallets
       ```

       For more information, visit the
       [Python SDK](/sdks/developer-controlled-wallets-python-sdk).
     </Tab>
   </Tabs>

<Note>
  If you are not using the Circle SDKs, you can generate and register your
  Entity Secret
  [manually](https://github.com/circlefin/w3s-entity-secret-sample-code) with
  standard libraries or CLI tools.
</Note>

## Introduction

The Entity Secret is a randomly generated 32-byte key used to secure
developer-controlled wallets. After generation, it is encrypted into ciphertext
for safe use in API requests. The ciphertext must be re-encrypted (rotated)
whenever required by API operations.

## 1. Generate an Entity Secret

Use the SDK to generate your Entity Secret. This creates a 32-byte hex string
and prints it in your terminal.

<CodeGroup>
  ```javascript Node.js SDK theme={null}
  import { generateEntitySecret } from "@circle-fin/developer-controlled-wallets";

  generateEntitySecret();
  ```

  ```python Python SDK theme={null}
  from circle.web3 import utils

  utils.generate_entity_secret()
  ```
</CodeGroup>

## 2. Register the Entity Secret

Register your Entity Secret with Circle using the SDK. Both the encryption of
the Entity Secret and its ciphertext registration is managed by the SDK
automatically.

<CodeGroup>
  ```ts Node.js SDK theme={null}
  import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";

  const response = await registerEntitySecretCiphertext({
    apiKey:
      "****_API_KEY:5bef73***************d000:89a4aa************************b09",
    entitySecret: "ecd4d5e33b8e***************************************c546",
    recoveryFileDownloadPath: "",
  });
  console.log(response.data?.recoveryFile);
  ```

  ```python Python SDK theme={null}
  from circle.web3 import utils

  result = utils.register_entity_secret_ciphertext(
      api_key=
      '****_API_KEY:5bef73***************d000:89a4aa************************b09',
      entity_secret=
      'ecd4d5e33b8e***************************************c546',
      recoveryFileDownloadPath='')
  print(result)
  ```
</CodeGroup>

<Warning>
  **Secure Your Entity Secret and Recovery File**

  You are solely responsible for securing your Entity Secret and its recovery
  file. Failure to do so may result in the irreversible loss of access to your
  wallets and associated funds.

  * **Store your Entity Secret securely:** for example, in a password manager.
    This Entity Secret is required for future API calls.
  * **Save the recovery file** when registering your Entity Secret. Use the
    `recoveryFileDownloadPath` parameter in the SDK method and store the file in a
    safe, separate location. This file is the only way to reset your Entity Secret
    if it's lost.

  **Note:** Circle does not store your Entity Secret and cannot recover it for
  you.
</Warning>

## Final Considerations

Keep the following points in mind when using your registered Entity Secret:

* Each API request requires a new Entity Secret ciphertext. The SDK
  automatically re-encrypts the Entity Secret for each request when needed.
* Circle's
  [APIs Requiring Entity Secret Ciphertext](/wallets/dev-controlled/entity-secret-management#apis-requiring-entity-secret-ciphertext)
  enforce one-time-use ciphertexts to prevent replay attacks.
* Do not reuse ciphertexts across multiple API requests: reused ciphertexts will
  cause those requests to be rejected.

These practices ensure secure and compliant use of developer-controlled wallets.

## Next Steps

You've successfully registered your entity secret! Continue with the following
guides:

1. [Create your first developer-controlled wallet](/wallets/dev-controlled/create-your-first-wallet)
2. [Transfer Tokens across Wallets](/wallets/dev-controlled/transfer-tokens-across-wallets):
   Learn how to
   [rotate and reset](/wallets/dev-controlled/entity-secret-management#how-to-rotate-the-entity-secret)
   your Entity Secret.


---

> To find navigation and other pages in this documentation, fetch the llms.txt file at: https://developers.circle.com/llms.txt