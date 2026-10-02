interface XmlAttribute {
  prefix: string;
  localName: string;
  name: string;
  value: string;
  isNamespace: boolean;
}

interface XmlNode {
  type: 'element' | 'text';
  name?: string;
  prefix?: string;
  localName?: string;
  attributes?: XmlAttribute[];
  children?: XmlNode[];
  text?: string;
}

/**
 * Escapes XML text for canonicalization
 */
function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#xD;');
}

/**
 * Escapes XML attribute value for canonicalization
 */
function escapeAttrValue(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;')
    .replace(/\n/g, '&#xA;')
    .replace(/\r/g, '&#xD;');
}

/**
 * Simple, robust XML tokenizer for canonicalization
 */
function parseXmlFragment(xml: string): XmlNode {
  const trimmed = xml.trim();
  let index = 0;

  function parseElement(): XmlNode {
    // Expect '<'
    if (trimmed[index] !== '<') {
      throw new Error(`Expected '<' at index ${index}`);
    }
    index++; // skip '<'

    // Read tag name
    let tagName = '';
    while (index < trimmed.length && !/\s|\/|>/.test(trimmed[index])) {
      tagName += trimmed[index++];
    }

    const colonIdx = tagName.indexOf(':');
    const prefix = colonIdx > -1 ? tagName.substring(0, colonIdx) : '';
    const localName = colonIdx > -1 ? tagName.substring(colonIdx + 1) : tagName;

    const attributes: XmlAttribute[] = [];

    // Read attributes
    while (index < trimmed.length) {
      // Skip whitespace
      while (index < trimmed.length && /\s/.test(trimmed[index])) {
        index++;
      }

      if (trimmed[index] === '>' || trimmed[index] === '/') {
        break;
      }

      // Read attr name
      let attrName = '';
      while (index < trimmed.length && !/\s|=|>|\//.test(trimmed[index])) {
        attrName += trimmed[index++];
      }

      // Skip whitespace around '='
      while (index < trimmed.length && /\s/.test(trimmed[index])) {
        index++;
      }

      if (trimmed[index] === '=') {
        index++; // skip '='
        while (index < trimmed.length && /\s/.test(trimmed[index])) {
          index++;
        }

        const quote = trimmed[index];
        if (quote === '"' || quote === "'") {
          index++; // skip quote
          let attrVal = '';
          while (index < trimmed.length && trimmed[index] !== quote) {
            attrVal += trimmed[index++];
          }
          index++; // skip closing quote

          const aColon = attrName.indexOf(':');
          const isNs = attrName === 'xmlns' || attrName.startsWith('xmlns:');
          const aPrefix = aColon > -1 ? attrName.substring(0, aColon) : '';
          const aLocal = aColon > -1 ? attrName.substring(aColon + 1) : attrName;

          attributes.push({
            prefix: aPrefix,
            localName: aLocal,
            name: attrName,
            value: attrVal,
            isNamespace: isNs,
          });
        }
      }
    }

    const isSelfClosing = trimmed[index] === '/';
    if (isSelfClosing) {
      index++; // skip '/'
    }
    if (trimmed[index] === '>') {
      index++; // skip '>'
    }

    const children: XmlNode[] = [];
    if (!isSelfClosing) {
      // Read child elements or text until </tagName>
      while (index < trimmed.length) {
        if (trimmed.startsWith(`</${tagName}`, index)) {
          // Closing tag
          index = trimmed.indexOf('>', index) + 1;
          break;
        }

        if (trimmed[index] === '<') {
          if (trimmed.startsWith('<!--', index)) {
            // Comment - skip in without comments C14N
            const endComment = trimmed.indexOf('-->', index);
            index = endComment > -1 ? endComment + 3 : trimmed.length;
          } else if (trimmed.startsWith('<![CDATA[', index)) {
            const endCdata = trimmed.indexOf(']]>', index);
            const cdataText = trimmed.substring(index + 9, endCdata > -1 ? endCdata : trimmed.length);
            children.push({ type: 'text', text: escapeText(cdataText) });
            index = endCdata > -1 ? endCdata + 3 : trimmed.length;
          } else if (trimmed[index + 1] === '/') {
            // Some other closing tag
            index = trimmed.indexOf('>', index) + 1;
            break;
          } else {
            children.push(parseElement());
          }
        } else {
          // Text content
          let text = '';
          while (index < trimmed.length && trimmed[index] !== '<') {
            text += trimmed[index++];
          }
          if (text.length > 0) {
            children.push({ type: 'text', text: escapeText(text) });
          }
        }
      }
    }

    return {
      type: 'element',
      name: tagName,
      prefix,
      localName,
      attributes,
      children,
    };
  }

  return parseElement();
}

/**
 * Serializes an XML node tree to Exclusive C14N
 */
function serializeC14N(
  node: XmlNode,
  renderedNamespaces: Map<string, string>,
): string {
  if (node.type === 'text') {
    return node.text ?? '';
  }

  const currentNamespaces = new Map(renderedNamespaces);
  const nsToRender: Array<{ prefix: string; name: string; uri: string }> = [];
  const regularAttrs: XmlAttribute[] = [];

  // 1. Process explicit namespace declarations in this element
  if (node.attributes) {
    for (const attr of node.attributes) {
      if (attr.isNamespace) {
        const prefix = attr.name === 'xmlns' ? '' : attr.localName;
        const uri = attr.value;
        if (currentNamespaces.get(prefix) !== uri) {
          currentNamespaces.set(prefix, uri);
          nsToRender.push({
            prefix,
            name: attr.name,
            uri,
          });
        }
      } else {
        regularAttrs.push(attr);
      }
    }
  }

  // 2. Sort namespace declarations: default xmlns first, then xmlns:prefix alphabetically by prefix
  nsToRender.sort((a, b) => {
    if (a.prefix === '') return -1;
    if (b.prefix === '') return 1;
    return a.prefix.localeCompare(b.prefix);
  });

  // 3. Sort regular attributes by namespace URI first, then by local name
  regularAttrs.sort((a, b) => {
    const aUri = a.prefix ? currentNamespaces.get(a.prefix) || '' : '';
    const bUri = b.prefix ? currentNamespaces.get(b.prefix) || '' : '';
    if (aUri !== bUri) {
      return aUri.localeCompare(bUri);
    }
    return a.localName.localeCompare(b.localName);
  });

  let out = `<${node.name}`;

  // Append sorted namespaces
  for (const ns of nsToRender) {
    out += ` ${ns.name}="${escapeAttrValue(ns.uri)}"`;
  }

  // Append sorted attributes
  for (const attr of regularAttrs) {
    out += ` ${attr.name}="${escapeAttrValue(attr.value)}"`;
  }

  out += '>';

  // Append children
  if (node.children) {
    for (const child of node.children) {
      out += serializeC14N(child, currentNamespaces);
    }
  }

  out += `</${node.name}>`;
  return out;
}

/**
 * Performs Exclusive XML Canonicalization 1.0 (http://www.w3.org/2001/10/xml-exc-c14n#) without comments
 */
export function canonicalizeExclusive(xml: string): string {
  const root = parseXmlFragment(xml);
  return serializeC14N(root, new Map());
}
