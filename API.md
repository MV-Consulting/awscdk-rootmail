# awscdk-rootmail

See the ADR from superwerker about the rootmail feature [here](https://github.com/superwerker/superwerker/blob/main/docs/adrs/rootmail.md)

## Known issues
- https://github.com/aws/jsii/issues/2071: so adding  `compilerOptions."esModuleInterop": true,` in `tsconfig.json` is not possble. See [aws-sdk](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/#Usage_with_TypeScript). So change from `import AWS from 'aws-sdk';` to `import * as AWS from 'aws-sdk';`
# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### GenerateEmailAddress <a name="GenerateEmailAddress" id="awscdk-rootmail.GenerateEmailAddress"></a>

#### Initializers <a name="Initializers" id="awscdk-rootmail.GenerateEmailAddress.Initializer"></a>

```typescript
import { GenerateEmailAddress } from 'awscdk-rootmail'

new GenerateEmailAddress(scope: Construct, id: string, props: GenerateEmailAddressProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#awscdk-rootmail.GenerateEmailAddress.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#awscdk-rootmail.GenerateEmailAddress.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#awscdk-rootmail.GenerateEmailAddress.Initializer.parameter.props">props</a></code> | <code><a href="#awscdk-rootmail.GenerateEmailAddressProps">GenerateEmailAddressProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="awscdk-rootmail.GenerateEmailAddress.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="awscdk-rootmail.GenerateEmailAddress.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="awscdk-rootmail.GenerateEmailAddress.Initializer.parameter.props"></a>

- *Type:* <a href="#awscdk-rootmail.GenerateEmailAddressProps">GenerateEmailAddressProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#awscdk-rootmail.GenerateEmailAddress.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="awscdk-rootmail.GenerateEmailAddress.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#awscdk-rootmail.GenerateEmailAddress.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="awscdk-rootmail.GenerateEmailAddress.isConstruct"></a>

```typescript
import { GenerateEmailAddress } from 'awscdk-rootmail'

GenerateEmailAddress.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="awscdk-rootmail.GenerateEmailAddress.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#awscdk-rootmail.GenerateEmailAddress.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#awscdk-rootmail.GenerateEmailAddress.property.email">email</a></code> | <code>string</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="awscdk-rootmail.GenerateEmailAddress.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `email`<sup>Required</sup> <a name="email" id="awscdk-rootmail.GenerateEmailAddress.property.email"></a>

```typescript
public readonly email: string;
```

- *Type:* string

---


### Rootmail <a name="Rootmail" id="awscdk-rootmail.Rootmail"></a>

#### Initializers <a name="Initializers" id="awscdk-rootmail.Rootmail.Initializer"></a>

```typescript
import { Rootmail } from 'awscdk-rootmail'

new Rootmail(scope: Construct, id: string, props: RootmailProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#awscdk-rootmail.Rootmail.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#awscdk-rootmail.Rootmail.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#awscdk-rootmail.Rootmail.Initializer.parameter.props">props</a></code> | <code><a href="#awscdk-rootmail.RootmailProps">RootmailProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="awscdk-rootmail.Rootmail.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="awscdk-rootmail.Rootmail.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="awscdk-rootmail.Rootmail.Initializer.parameter.props"></a>

- *Type:* <a href="#awscdk-rootmail.RootmailProps">RootmailProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#awscdk-rootmail.Rootmail.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="awscdk-rootmail.Rootmail.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#awscdk-rootmail.Rootmail.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### ~~`isConstruct`~~ <a name="isConstruct" id="awscdk-rootmail.Rootmail.isConstruct"></a>

```typescript
import { Rootmail } from 'awscdk-rootmail'

Rootmail.isConstruct(x: any)
```

Checks if `x` is a construct.

###### `x`<sup>Required</sup> <a name="x" id="awscdk-rootmail.Rootmail.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#awscdk-rootmail.Rootmail.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |

---

##### `node`<sup>Required</sup> <a name="node" id="awscdk-rootmail.Rootmail.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---


## Structs <a name="Structs" id="Structs"></a>

### GenerateEmailAddressProps <a name="GenerateEmailAddressProps" id="awscdk-rootmail.GenerateEmailAddressProps"></a>

#### Initializer <a name="Initializer" id="awscdk-rootmail.GenerateEmailAddressProps.Initializer"></a>

```typescript
import { GenerateEmailAddressProps } from 'awscdk-rootmail'

const generateEmailAddressProps: GenerateEmailAddressProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#awscdk-rootmail.GenerateEmailAddressProps.property.domain">domain</a></code> | <code>string</code> | The domain for the email to be generated, ....@<domain>. |
| <code><a href="#awscdk-rootmail.GenerateEmailAddressProps.property.name">name</a></code> | <code>string</code> | The account name. |

---

##### `domain`<sup>Required</sup> <a name="domain" id="awscdk-rootmail.GenerateEmailAddressProps.property.domain"></a>

```typescript
public readonly domain: string;
```

- *Type:* string

The domain for the email to be generated, ....@<domain>.

---

##### `name`<sup>Required</sup> <a name="name" id="awscdk-rootmail.GenerateEmailAddressProps.property.name"></a>

```typescript
public readonly name: string;
```

- *Type:* string

The account name.

---

### RootmailProps <a name="RootmailProps" id="awscdk-rootmail.RootmailProps"></a>

#### Initializer <a name="Initializer" id="awscdk-rootmail.RootmailProps.Initializer"></a>

```typescript
import { RootmailProps } from 'awscdk-rootmail'

const rootmailProps: RootmailProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#awscdk-rootmail.RootmailProps.property.domain">domain</a></code> | <code>string</code> | Domain used for root mail feature. |
| <code><a href="#awscdk-rootmail.RootmailProps.property.subdomain">subdomain</a></code> | <code>string</code> | Subdomain used for root mail feature. |

---

##### `domain`<sup>Required</sup> <a name="domain" id="awscdk-rootmail.RootmailProps.property.domain"></a>

```typescript
public readonly domain: string;
```

- *Type:* string

Domain used for root mail feature.

Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information

---

##### `subdomain`<sup>Required</sup> <a name="subdomain" id="awscdk-rootmail.RootmailProps.property.subdomain"></a>

```typescript
public readonly subdomain: string;
```

- *Type:* string
- *Default:* 'aws'

Subdomain used for root mail feature.

Please see https://github.com/superwerker/superwerker/blob/main/README.md#technical-faq for more information

---



