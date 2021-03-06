import { all, each } from 'lodash/collection';
import test from 'tape';

import RelationTree, {
  isRelationTree,
  mergeTrees,
  fromString,
  compile,
  normalize,
  renestRecursives
} from '../../lib/relation-tree';

test('RelationTree', (t) => {

  t.test('isRelationTree', st => {
    st.equal(
      RelationTree.isRelationTree(new RelationTree()),
      true,
      'correctly identifies a RelationTree'
    );

    st.equal(
      RelationTree.isRelationTree(undefined),
      false,
      'returns false for `undefined`'
    );

    st.equal(
      RelationTree.isRelationTree('a.b.c'),
      false,
      'returns false for string'
    );

    st.end();
  });

  t.test('fromString', st => {

    const initializerFn = function() {};

    const tests = {
      'with single string input': {
        input: ['test'],
        output: { test: {} }
      },
      'with nested relations': {
        input: ['a.b.c.d'],
        output: {
          a: { nested: { b: { nested: { c: { nested: { d: {} } } } } } }
        }
      },
      'with an initializer': {
        input: ['test', initializerFn],
        output: { test: { initializer: initializerFn } }
      },
      'nested with an initializer': {
        input: ['a.b', initializerFn],
        output: { a: { nested: { b: { initializer: initializerFn } } } }
      },
      'simple recursive relation "test^1"': {
        input: ['test^1'],
        output: { test: { recursions: 1 } }
      },
      'default recursive depth "test^"': {
        input: ['test^'],
        output: { test: { recursions: 1 } }
      },
      'infinite recursion "test^Infinity"': {
        input: ['test^Infinity'],
        output: { test: { recursions: Infinity } }
      },
      'recursion with further nesting "test^2.other"': {
        input: ['test^2.other'],
        output: { test: { recursions: 2, nested: { other: {} } } }
      }
    };

    each(tests, (item, message) => {
      st.deepEqual(
        fromString(...item.input),
        item.output,
        message
      );
    });

    st.throws(() => fromString(), TypeError,
      'throws `TypeError` without argument'
    );

    st.throws(() => fromString(5), TypeError,
      'throws `TypeError` with non-string argument'
    );

    st.end();
  });

  t.test('mergeTrees', st => {

    const a = fromString('a.b.c');
    const b = fromString('a.b.d');

    const merged = mergeTrees(a, b);

    st.ok(
      all([
        merged,
        merged,
        merged.a.nested,
        merged.a.nested.b.nested
      ], isRelationTree),
      'merged trees are RelationTree instances all the way down'
    );

    st.end();
  });

  t.test('compile', st => {

    const initializerFnA = function() {};
    const initializerFnB = function() {};

    const tests = {
      'with no arguments': {
        input: [],
        output: {}
      },
      'with nested empty arrays, empty objects and `null` values': {
        input: [[[[{}, {}], {}],[null, null]]],
        output: {}
      },
      'with single string relation': {
        input: ['test'],
        output: { test: {} }
      },
      'with single string in array': {
        input: [['test']],
        output: { test: {} }
      },
      'with two strings': {
        input: ['a', 'b'],
        output: { a: {}, b: {} }
      },
      'with an array of two strings': {
        input: [['a', 'b']],
        output: { a: {}, b: {} }
      },
      'an object {[relation]: initializer}': {
        input: [{a: initializerFnA, b: initializerFnB}],
        output: {
          a: { initializer: initializerFnA },
          b: { initializer: initializerFnB }
        }
      },
      'an array with single string and an object': {
        input: ['a', {b: initializerFnB}],
        output: {
          a: {}, b: { initializer: initializerFnB }
        }
      },
      'two relations sharing a child as common parent': {
        input: ['a.b', 'a.c'],
        output: {
          a: { nested: { b: {}, c: {} } }
        }
      },
      'two relations sharing a deeply nested child as parent': {
        input: ['a.b.c.d', 'a.b.c.e'],
        output: {
          a: { nested: { b: { nested: { c: { nested: { d: {}, e: {} } } } } } }
        }
      },
      'two relations from a common child, one with initializer': {
        input: ['a.b', {'a.c': initializerFnA}],
        output: {
          a: { nested: { b: {}, c: { initializer: initializerFnA } } }
        }
      },
      'merges two `RelationTree` instances': {
        input: [fromString('a.b'), fromString('a.c')],
        output: {
          a: { nested: { b: {}, c: {} } }
        }
      },
      'merges recursive relations': {
        input: ['a^.b', 'a^.c^2'],
        output: {
          a: { recursions: 1, nested: { b: {}, c: { recursions: 2 } } }
        }
      }
    };

    each(tests, (item, message) => {
      st.deepEqual(
        compile(...item.input),
        item.output,
        message
      );
    });

    st.end();
  });

  t.test('renestRecursives', st => {

    const tests = {
      'simple recursive': {
        input: [fromString('a^')],
        output: {
          a: { recursions: 1, nested: { a: { recursions: 0 } } }
        }
      },
      'infinite recursive': {
        input: [fromString('a^Infinity')],
        output: {
          a: { recursions: Infinity, nested: { a: { recursions: Infinity } } }
        }
      },
      'two sibling recursives': {
        input: [compile('a^3', 'b^99')],
        output: {
          a: { recursions: 3, nested: { a: { recursions: 2 } } },
          b: { recursions: 99, nested: { b: { recursions: 98 } } },
        }
      },
      'preserve nesting after recursive': {
        input: [fromString('a^2.b^2')],
        output: {
          a: {
            recursions: 2,
            nested: {
              a: {
                recursions: 1,
                nested: { b: { recursions: 2 } }
              }
            }
          }
        }
      },
      'do not renest recursives with recursion count 0': {
        input: [fromString('a^0')],
        output: {
          a: { recursions: 0 }
        }
      },
      'do not renest recursives that are already nested': {
        input: [
          new RelationTree({
            a: { recursions: 2, nested: { a: { recursions: 1 } } }
          })
        ],
        output: {
          a: { recursions: 2, nested: { a: { recursions: 1 } } }
        }
      }
    };

    each(tests, (item, message) => {
      st.deepEqual(
        renestRecursives(...item.input),
        item.output,
        message
      );
    });

    const invalidRecursiveTree = new RelationTree({
      a: { recursions: 1, nested: { a: { recursions: 1 } } }
    });

    st.throws(() => renestRecursives(invalidRecursiveTree),
      'throws when given an invalid recursive tree'
    );

    st.end();
  });

  t.test('normalize', st => {

    const initializerFnA = function() {};
    const initializerFnB = function() {};

    const tests = {
      'normalizes a complex expression': {
        input: [
          'a.b',
          {'a.c.d': initializerFnA},
          {e: initializerFnB },
          'f^5'
        ],
        output: {
          a: {
            nested: {
              b: {},
              c: { nested: { d: { initializer: initializerFnA } } }
            }
          },
          e: { initializer: initializerFnB },
          f: {
            recursions: 5,
            nested: {
              f: { recursions: 4 }
            }
          }
        }
      }
    };

    each(tests, (item, message) => {
      st.deepEqual(
        normalize(...item.input),
        item.output,
        message
      );
    });

    const normalized = normalize('a.b.c', 'a.c.d');

    st.equal(normalized, normalize(normalized),
      'does nothing to an already normalized tree'
    );

    st.end();
  });
});
