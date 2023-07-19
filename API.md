# awscdk-rootmail

See the ADR from superwerker about the rootmail feature [here](https://github.com/superwerker/superwerker/blob/main/docs/adrs/rootmail.md)

## Known issues
- https://github.com/aws/jsii/issues/2071: so adding  `compilerOptions."esModuleInterop": true,` in `tsconfig.json` is not possble. See [aws-sdk](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/#Usage_with_TypeScript). So change from `import AWS from 'aws-sdk';` to `import * as AWS from 'aws-sdk';`
# API Reference <a name="API Reference" id="api-reference"></a>



## Classes <a name="Classes" id="Classes"></a>

### Hello <a name="Hello" id="awscdk-rootmail.Hello"></a>

#### Initializers <a name="Initializers" id="awscdk-rootmail.Hello.Initializer"></a>

```typescript
import { Hello } from 'awscdk-rootmail'

new Hello()
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#awscdk-rootmail.Hello.sayHello">sayHello</a></code> | *No description.* |

---

##### `sayHello` <a name="sayHello" id="awscdk-rootmail.Hello.sayHello"></a>

```typescript
public sayHello(): string
```





