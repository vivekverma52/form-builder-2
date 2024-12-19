'use client';

import { JsonFormsCellRendererRegistryEntry, JsonFormsRendererRegistryEntry, JsonSchema7, UISchemaElement } from '@jsonforms/core'
import {
  AddCircle as AddCircleIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Container,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useState } from 'react'
import { adjectives, colors, Config, uniqueNamesGenerator } from 'unique-names-generator'

// Add proper types for JsonForms props
interface JsonFormsProps {
  schema: JsonSchema7;
  uischema?: UISchemaElement;
  data: Record<string, unknown>;
  renderers: JsonFormsRendererRegistryEntry[];
  cells: JsonFormsCellRendererRegistryEntry[];
  onChange: (state: FormChangeEvent) => void;
}

// Update the dynamic import with proper typing
const JsonFormsComponent = dynamic<JsonFormsProps>(
  () => import('@jsonforms/react').then(mod => {
    const { JsonForms } = mod;
    const JsonFormsWrapper = ({ schema, uischema, data, renderers, cells, onChange }: JsonFormsProps) => (
      <JsonForms
        schema={schema}
        uischema={uischema}
        data={data}
        renderers={renderers}
        cells={cells}
        onChange={onChange}
      />
    );
    JsonFormsWrapper.displayName = 'JsonFormsWrapper';
    return JsonFormsWrapper;
  }),
  { ssr: false }
);

// Add proper types for renderers and cells
// type MaterialRenderer = any; // Replace with proper type from @jsonforms/material-renderers if available
// type MaterialCell = any; // Replace with proper type from @jsonforms/material-renderers if available



// Form types
type FormLayoutType = 'VerticalLayout' | 'HorizontalLayout' | 'Group' | 'Control';
type FormType = 'simple' | 'array' | 'group';
type ElementType = 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';

interface FormElement {
  type: ElementType;
  label: string;
  key: string;
  required?: boolean;
  properties?: {
    form?: FormField;
    type?: string;
    [key: string]: unknown;
  };
}

interface FormField {
  type: FormLayoutType;
  formType: FormType;
  label: string;
  key: string;
  elements: FormElement[];
  parent?: FormField;
  layout?: 'vertical' | 'horizontal';
}

interface SchemaObject {
  type: string;
  title?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  format?: string;
}

interface CustomJsonSchema extends JsonSchema7 {
  properties: Record<string, SchemaObject>;
  required: string[];
}

// Update UISchemaElement type to include our custom properties
// interface ExtendedUISchemaElement extends UISchemaElement {
//   type: string;
//   scope?: string;
//   options?: {
//     detail?: {
//       type: string;
//       elements: ExtendedUISchemaElement[];
//     };
//   };
//   elements?: ExtendedUISchemaElement[];
// }

// interface CustomUISchema extends ExtendedUISchemaElement {
//   elements: ExtendedUISchemaElement[];
// }

interface FormChangeEvent {
  data: Record<string, unknown>;
  errors: Array<{
    instancePath: string;
    message?: string;
    schemaPath: string;
    keyword: string;
    params: Record<string, unknown>;
  }>;
}

const generateHexFromString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 6);
};

const generateElementName = (type: ElementType | FormType): { label: string, key: string } => {
  const config: Config = {
    dictionaries: [adjectives, colors],
    separator: ' ',
    style: 'capital'
  };
  const baseName = uniqueNamesGenerator(config);
  const typeLabel = type === 'simple' || type === 'array' || type === 'group' 
    ? 'Form'
    : type.charAt(0).toUpperCase() + type.slice(1);
  const label = `${baseName} ${typeLabel}`;
  const key = `${label.toLowerCase().replace(/\s+/g, '-')}-${generateHexFromString(label)}`;
  return { label, key };
};

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [renderers, setRenderers] = useState<JsonFormsRendererRegistryEntry[]>([]);
  const [cells, setCells] = useState<JsonFormsCellRendererRegistryEntry[]>([]);
  const [forms, setForms] = useState<FormField[]>([]);
  const [selectedType, setSelectedType] = useState<FormType>('simple');
  const [selectedElementType, setSelectedElementType] = useState<ElementType>('string');
  const [editingForm, setEditingForm] = useState<FormField | null>(null);
  const [editingElement, setEditingElement] = useState<FormElement | null>(null);
  const [currentPath, setCurrentPath] = useState<FormField[]>([]);
  const [previewTab, setPreviewTab] = useState<number>(0);

  useEffect(() => {
    setIsClient(true);
    // Load renderers and cells
    Promise.all([
      import('@jsonforms/material-renderers').then(mod => mod.materialRenderers),
      import('@jsonforms/material-renderers').then(mod => mod.materialCells)
    ]).then(([renderers, cells]) => {
      setRenderers(renderers);
      setCells(cells);
    });
  }, []);

  // const generateKey = useCallback((prefix: string): string => {
  //   return generateUniqueKey(prefix);
  // }, []);

  const navigateToForm = useCallback((form: FormField): void => {
    setCurrentPath([...currentPath, form]);
  }, [currentPath]);

  const navigateBack = useCallback((): void => {
    setCurrentPath(currentPath.slice(0, -1));
  }, [currentPath]);

  const getCurrentForms = useCallback((): FormField[] => {
    if (currentPath.length === 0) return forms;
    
    // Get the last form in the path
    const lastForm = currentPath[currentPath.length - 1];
    
    // If it's a nested form, return its elements that are forms
    if (lastForm.formType === 'array' || lastForm.formType === 'group') {
      return lastForm.elements
        .filter(el => el.type === 'object' && el.properties?.form)
        .map(el => el.properties?.form as FormField);
    }
    
    return [];
  }, [currentPath, forms]);

  const setCurrentForms = useCallback((newForms: FormField[]): void => {
    if (currentPath.length === 0) {
      setForms(newForms);
      return;
    }

    // Get the last form in the path
    const lastForm = currentPath[currentPath.length - 1];
    
    // Convert FormFields to FormElements
    const newElements = lastForm.elements.map(element => {
      if (element.type === 'object' && element.properties?.form) {
        const form = element.properties.form;
        const updatedForm = newForms.find(newForm => newForm.key === form?.key);
        if (updatedForm) {
          return {
            ...element,
            properties: { ...element.properties, form: updatedForm }
          };
        }
      }
      return element;
    });
    
    lastForm.elements = newElements;
    setForms([...forms]);
  }, [currentPath, forms]);

  const addForm = useCallback((): void => {
    const { label, key } = generateElementName(selectedType);
    const newForm: FormField = {
      type: 'VerticalLayout',
      formType: selectedType,
      label,
      key,
      elements: [],
      parent: currentPath[currentPath.length - 1],
      layout: 'vertical'
    };

    if (currentPath.length === 0) {
      setForms([...forms, newForm]);
    } else {
      const lastForm = currentPath[currentPath.length - 1];
      const newElement: FormElement = {
        type: 'object',
        label,
        key,
        properties: {
          form: newForm
        }
      };
      lastForm.elements = [...lastForm.elements, newElement];
      setForms([...forms]);
    }
    setEditingForm(newForm);
  }, [selectedType, currentPath, forms]);

  const addElement = useCallback((form: FormField): void => {
    if (selectedElementType === 'object') {
      const { label, key } = generateElementName('object' as ElementType);
      const newForm: FormField = {
        type: 'VerticalLayout',
        formType: 'group',
        label,
        key,
        elements: [],
        parent: form
      };
      const newElement: FormElement = {
        type: 'object',
        label,
        key,
        properties: {
          type: 'object',
          form: newForm
        }
      };
      form.elements = [...form.elements, newElement];
      setForms([...forms]);
      navigateToForm(newForm);
    } else {
      const { label, key } = generateElementName(selectedElementType);
      const newElement: FormElement = {
        type: selectedElementType,
        label,
        key,
        required: false
      };
      form.elements = [...form.elements, newElement];
      setForms([...forms]);
      setEditingElement(newElement);
    }
  }, [selectedElementType, forms, navigateToForm]);

  const updateForm = useCallback((updatedForm: FormField): void => {
    const newKey = `${updatedForm.label.toLowerCase().replace(/\s+/g, '-')}-${generateHexFromString(updatedForm.label)}`;
    const formWithNewKey = {
      ...updatedForm,
      key: newKey
    };

    // Recursively update forms and their elements
    const updateNestedForms = (form: FormField): FormField => {
      if (form.key === updatedForm.key) {
        return formWithNewKey;
      }

      const updatedElements = form.elements.map(element => {
        if (element.type === 'object' && element.properties?.form) {
          const nestedForm = element.properties.form as FormField;
          const updatedNestedForm = updateNestedForms(nestedForm);
          
          if (updatedNestedForm !== nestedForm) {
            return {
              ...element,
              label: updatedNestedForm.label,
              key: updatedNestedForm.key,
              properties: {
                ...element.properties,
                form: updatedNestedForm
              }
            };
          }
        }
        return element;
      });

      return {
        ...form,
        elements: updatedElements
      };
    };

    const updatedForms = forms.map(form => updateNestedForms(form));
    setForms(updatedForms);

    // Update currentPath if the edited form is in the path
    setCurrentPath(currentPath.map(pathForm => {
      if (pathForm.key === updatedForm.key) {
        return formWithNewKey;
      }
      return updateNestedForms(pathForm);
    }));

    setEditingForm(null);
  }, [forms, currentPath]);

  const updateElement = useCallback((form: FormField, updatedElement: FormElement): void => {
    form.elements = form.elements.map(element =>
      element.key === updatedElement.key ? updatedElement : element
    );
    setForms([...forms]);
    setEditingElement(null);
  }, [forms, editingElement]);

  const deleteForm = useCallback((key: string): void => {
    if (currentPath.length === 0) {
      setForms(forms.filter(form => form.key !== key));
    } else {
      const lastForm = currentPath[currentPath.length - 1];
      lastForm.elements = lastForm.elements.filter(el => 
        !(el.type === 'object' && el.properties?.form?.key === key)
      );
      setForms([...forms]);
    }
    if (editingForm?.key === key) {
      setEditingForm(null);
    }
  }, [currentPath, forms, editingForm]);

  const deleteElement = useCallback((form: FormField, elementKey: string): void => {
    form.elements = form.elements.filter(element => element.key !== elementKey);
    setForms([...forms]);
    if (editingElement?.key === elementKey) {
      setEditingElement(null);
    }
  }, [forms, editingElement]);

  const generateFormSchema = useCallback((form: FormField): SchemaObject => {
    const processElements = (elements: FormElement[]): Record<string, SchemaObject> => {
      return elements.reduce<Record<string, SchemaObject>>((acc, element) => {
        if (element.type === 'object' && element.properties?.form) {
          // For nested forms, generate their schema recursively
          const nestedForm = element.properties.form;
          acc[element.key] = generateFormSchema(nestedForm);
        } else if (element.type === 'array') {
          // For array types, create a simple array schema
          acc[element.key] = {
            type: 'array',
            title: element.label,
            items: {
              type: 'string'
            }
          };
        } else if (element.type === 'date') {
          // For date types, use string type with date format
          acc[element.key] = {
            type: 'string',
            format: 'date',
            title: element.label
          };
        } else {
          acc[element.key] = {
            type: element.type,
            title: element.label
          };
        }
        return acc;
      }, {});
    };

    if (form.formType === 'simple' || form.formType === 'group') {
      const properties = processElements(form.elements);
      const required = form.elements
        .filter(el => el.required)
        .map(el => el.key);
      
      return {
        type: 'object',
        title: form.label,
        properties,
        ...(required.length > 0 ? { required } : {})
      };
    } else if (form.formType === 'array') {
      const properties = processElements(form.elements);
      const required = form.elements
        .filter(el => el.required)
        .map(el => el.key);
      
      return {
        type: 'array',
        title: form.label,
        items: {
          type: 'object',
          properties,
          ...(required.length > 0 ? { required } : {})
        }
      };
    }
    
    return {
      type: 'object',
      properties: {}
    };
  }, []);

  const generateJsonSchema = useCallback((): CustomJsonSchema => {
    const schema: CustomJsonSchema = {
      type: 'object',
      properties: {},
      required: []
    };

    // Keep track of processed forms to avoid duplicates
    const processedForms = new Set<string>();

    const processForm = (form: FormField, parentPath?: string) => {
      // Skip if this form has already been processed
      if (processedForms.has(form.key)) {
        return;
      }

      // For nested forms, we only want to process them within their parent context
      if (form.parent && !parentPath) {
        return;
      }

      const formSchema = generateFormSchema(form);
      
      // If this is a nested form, add it to its parent's properties
      if (parentPath) {
        // Split the parent path to navigate the schema
        const pathParts = parentPath.split('.');
        let currentObj: Record<string, SchemaObject> = schema.properties;
        
        // Navigate to the correct location in the schema
        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i];
          if (i === pathParts.length - 1) {
            // Last part - this is where we add the new form
            if (currentObj[part]?.type === 'array' && currentObj[part].items?.properties) {
              currentObj[part].items.properties[form.key] = formSchema;
            } else if (currentObj[part]?.properties) {
              currentObj[part].properties[form.key] = formSchema;
            }
          } else {
            // Navigate through the schema
            if (currentObj[part]?.type === 'array' && currentObj[part].items?.properties) {
              currentObj = currentObj[part].items.properties;
            } else if (currentObj[part]?.properties) {
              currentObj = currentObj[part].properties;
            }
          }
        }
      } else {
        schema.properties[form.key] = formSchema;
        if (form.elements.some(el => el.required)) {
          schema.required.push(form.key);
        }
      }

      // Mark this form as processed
      processedForms.add(form.key);

      // Process nested forms
      form.elements.forEach(element => {
        if (element.type === 'object' && element.properties?.form) {
          const nestedForm = element.properties.form as FormField;
          const newParentPath = parentPath ? `${parentPath}.${form.key}` : form.key;
          processForm(nestedForm, newParentPath);
        }
      });
    };

    // Only process root-level forms initially
    forms.filter(form => !form.parent).forEach(form => processForm(form));

    return schema;
  }, [forms, generateFormSchema]);

  const schema = generateJsonSchema();

  const handleTypeChange = useCallback((event: SelectChangeEvent<string>) => {
    setSelectedType(event.target.value as FormType);
  }, []);

  const handleElementTypeChange = useCallback((event: SelectChangeEvent<string>) => {
    setSelectedElementType(event.target.value as ElementType);
  }, []);

  const handleTabChange = useCallback((_: React.SyntheticEvent, value: number) => {
    setPreviewTab(value);
  }, []);

  const handleFormChange = useCallback((state: FormChangeEvent) => {
    console.log('Form data:', state.data);
    console.log('Form errors:', state.errors);
  }, []);

  const handleElementClick = useCallback((element: FormElement): void => {
    if (element.type === 'object' && element.properties?.form) {
      navigateToForm(element.properties.form as FormField);
    }
  }, [navigateToForm]);

  const theme = createTheme({
    shape: {
      borderRadius: 12
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8
          }
        }
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: 8
          }
        }
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8
            }
          }
        }
      }
    }
  });

  const generateUiSchema = useCallback((schema: CustomJsonSchema): UISchemaElement => {
    const cleanScopePath = (scope: string): string => {
      if (!scope.startsWith('#/properties/')) return scope;
      const parts = scope.split('/');
      // If we have more than 3 parts (#, properties, elementKey), take the last one
      return parts.length > 3 ? `#/properties/${parts[parts.length - 1]}` : scope;
    };

    const getGroupFormElements = (properties: Record<string, SchemaObject>, groupPath: string) => {
      return Object.keys(properties).map(elemKey => ({
        type: 'Control',
        scope: `${groupPath}/properties/${elemKey}`
      }));
    };

    const getSimpleFormElements = (properties: Record<string, SchemaObject>) => {
      return Object.keys(properties).map(elemKey => ({
        type: 'Control',
        scope: cleanScopePath(`#/properties/${elemKey}`)
      }));
    };

    const processArrays = (schemaObj: SchemaObject, path: string = '', form?: FormField): UISchemaElement | unknown => {
      if (schemaObj.type === 'array' && schemaObj.items?.properties) {
        const elements = Object.entries(schemaObj.items.properties).map(([propKey, propValue]) => {
          if (propValue.type === 'array') {
            return processArrays(propValue, `#/properties/${propKey}`, form);
          }
          if (propValue.type === 'object' && propValue.properties) {
            // Find the nested form if it exists
            const nestedForm = forms.find(f => f.key === propKey);
            if (nestedForm?.formType === 'simple') {
              return {
                type: 'Control',
                scope: cleanScopePath(`#/properties/${propKey}`),
                options: {
                  detail: {
                    type: 'VerticalLayout',
                    elements: getSimpleFormElements(propValue.properties)
                  }
                }
              };
            }
            if (nestedForm?.formType === 'group') {
              return {
                type: 'Group',
                label: nestedForm.label,
                scope: `#/properties/${propKey}`,
                elements: getGroupFormElements(propValue.properties, `#/properties/${propKey}`)
              };
            }
            const nestedElements = Object.entries(propValue.properties).map(([nestedKey, nestedValue]) => {
              if (nestedValue.type === 'array') {
                return processArrays(nestedValue, `#/properties/${nestedKey}`, nestedForm);
              }
              if (nestedValue.type === 'object' && nestedValue.properties) {
                const nestedNestedForm = forms.find(f => f.key === nestedKey);
                if (nestedNestedForm?.formType === 'simple') {
                  return {
                    type: 'Control',
                    scope: cleanScopePath(`#/properties/${nestedKey}`),
                    options: {
                      detail: {
                        type: 'VerticalLayout',
                        elements: getSimpleFormElements(nestedValue.properties)
                      }
                    }
                  };
                }
                if (nestedNestedForm?.formType === 'group') {
                  return {
                    type: 'Group',
                    label: nestedNestedForm.label,
                    scope: `#/properties/${nestedKey}`,
                    elements: getGroupFormElements(nestedValue.properties, `#/properties/${nestedKey}`)
                  };
                }
                return processObject(nestedValue, `#/properties/${nestedKey}`, nestedNestedForm);
              }
              return {
                type: 'Control',
                scope: cleanScopePath(`#/properties/${nestedKey}`)
              };
            });
            return {
              type: 'Control',
              scope: cleanScopePath(`#/properties/${propKey}`),
              options: {
                detail: {
                  type: 'VerticalLayout',
                  elements: nestedElements
                }
              }
            };
          }
          return {
            type: 'Control',
            scope: cleanScopePath(`#/properties/${propKey}`)
          };
        });

        return {
          type: 'Control',
          scope: cleanScopePath(path),
          options: {
            detail: {
              type: form?.layout === 'horizontal' ? 'HorizontalLayout' : 'VerticalLayout',
              elements
            }
          }
        };
      }
      return null;
    };

    const processObject = (schemaObj: SchemaObject, path: string = '', currentForm?: FormField): UISchemaElement | unknown => {
      if (schemaObj.type === 'object' && schemaObj.properties) {
        const elements = Object.entries(schemaObj.properties).map(([key, prop]) => {
          const newPath = path ? `${path}/${key}` : `#/properties/${key}`;
          const nestedForm = forms.find(f => f.key === key);
          if (prop.type === 'array') {
            return processArrays(prop, newPath, nestedForm);
          }
          if (prop.type === 'object' && prop.properties) {
            if (nestedForm?.formType === 'simple') {
              return {
                type: 'Control',
                scope: cleanScopePath(newPath),
                options: {
                  detail: {
                    type: 'VerticalLayout',
                    elements: getSimpleFormElements(prop.properties)
                  }
                }
              };
            }
            if (nestedForm?.formType === 'group') {
              return {
                type: 'Group',
                label: nestedForm.label,
                scope: newPath,
                elements: getGroupFormElements(prop.properties, newPath)
              };
            }
            return processObject(prop, newPath, nestedForm);
          }
          return {
            type: 'Control',
            scope: cleanScopePath(newPath)
          };
        });

        if (currentForm?.formType === 'group') {
          return {
            type: 'Group',
            label: currentForm.label,
            scope: path,
            elements
          };
        }
        if (currentForm?.formType === 'simple') {
          return {
            type: 'Control',
            scope: cleanScopePath(path),
            options: {
              detail: {
                type: 'VerticalLayout',
                elements
              }
            }
          };
        }
        return {
          type: 'Control',
          scope: cleanScopePath(path),
          options: {
            detail: {
              type: 'VerticalLayout',
              elements
            }
          }
        };
      }
      return null;
    };

    const rootElements = Object.entries(schema.properties)
      .map(([key, prop]) => {
        const path = `#/properties/${key}`;
        const form = forms.find(f => f.key === key);
        
        if (prop.type === 'array') {
          return processArrays(prop, path, form);
        }
        if (prop.type === 'object' && prop.properties) {
          if (form?.formType === 'simple') {
            return {
              type: 'Control',
              scope: cleanScopePath(path),
              options: {
                detail: {
                  type: 'VerticalLayout',
                  elements: getSimpleFormElements(prop.properties)
                }
              }
            };
          }
          if (form?.formType === 'group') {
            return {
              type: 'Group',
              label: form.label,
              scope: path,
              elements: getGroupFormElements(prop.properties, path)
            };
          }
          return processObject(prop, path, form);
        }
        return {
          type: 'Control',
          scope: cleanScopePath(path)
        };
      })
      .filter(Boolean);

    return {
      type: 'VerticalLayout',
      elements: rootElements
    } as UISchemaElement;
  }, [forms]);

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" gap={4} minHeight="calc(100vh - 64px)">
          <Paper sx={{ width: '50%', p: 3 }} elevation={2}>
            <Typography variant="h5" gutterBottom fontWeight="bold">
              Form Builder
            </Typography>
            {currentPath.length > 0 && (
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={navigateBack}
                sx={{ mb: 2 }}
              >
                Back to {currentPath[currentPath.length - 1]?.parent?.label || 'Root'}
              </Button>
            )}
            <Stack direction="row" spacing={2} mb={3}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Form Type</InputLabel>
                <Select
                  value={selectedType}
                  label="Form Type"
                  onChange={handleTypeChange}
                >
                  <MenuItem value="simple">Simple Form</MenuItem>
                  <MenuItem value="array">Array Form</MenuItem>
                  <MenuItem value="group">Group Form</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={addForm}
              >
                Add Form
              </Button>
            </Stack>
            {currentPath.length > 0 && (
              <Box mb={2}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    size="small"
                    onClick={() => setCurrentPath([])}
                  >
                    Root
                  </Button>
                  {currentPath.map((form, index) => (
                    <React.Fragment key={form.key}>
                      <Typography color="text.secondary">/</Typography>
                      <Button
                        size="small"
                        onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                      >
                        {form.label}
                      </Button>
                    </React.Fragment>
                  ))}
                </Stack>
              </Box>
            )}
            <Stack spacing={2}>
              {getCurrentForms().map((form) => (
                <Card key={form.key} variant="outlined">
                  <CardContent>
                    {editingForm?.key === form.key ? (
                      <Stack spacing={2}>
                        <TextField
                          label="Form Label"
                          value={editingForm.label}
                          onChange={(e) => setEditingForm({...editingForm, label: e.target.value})}
                          size="small"
                          fullWidth
                        />
                        {editingForm.formType === 'array' && (
                          <FormControl size="small" fullWidth>
                            <InputLabel>Layout</InputLabel>
                            <Select
                              value={editingForm.layout || 'vertical'}
                              label="Layout"
                              onChange={(e) => setEditingForm({...editingForm, layout: e.target.value as 'vertical' | 'horizontal'})}
                            >
                              <MenuItem value="vertical">Vertical</MenuItem>
                              <MenuItem value="horizontal">Horizontal</MenuItem>
                            </Select>
                          </FormControl>
                        )}
                        <Stack direction="row" spacing={1}>
                          <Button
                            variant="contained"
                            color="success"
                            onClick={() => updateForm(editingForm)}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={() => setEditingForm(null)}
                          >
                            Cancel
                          </Button>
                        </Stack>
                      </Stack>
                    ) : (
                      <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Box>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {form.label}
                            </Typography>
                            <Box display="flex" gap={1} mt={0.5}>
                              <Chip
                                size="small"
                                label={form.formType}
                                variant="outlined"
                              />
                              <Chip
                                size="small"
                                label={`${form.elements.length} elements`}
                                variant="outlined"
                              />
                            </Box>
                          </Box>
                          <Box display="flex" alignItems="center" gap={1}>
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                              <Select
                                value={selectedElementType}
                                onChange={handleElementTypeChange}
                                size="small"
                              >
                                <MenuItem value="string">Text</MenuItem>
                                <MenuItem value="number">Number</MenuItem>
                                <MenuItem value="boolean">Boolean</MenuItem>
                                <MenuItem value="date">Date</MenuItem>
                                {(form.formType === 'array' || form.formType === 'group') && (
                                  <MenuItem value="object">Nested Form</MenuItem>
                                )}
                              </Select>
                            </FormControl>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => addElement(form)}
                              sx={{ minWidth: 0, p: 1 }}
                            >
                              <AddCircleIcon />
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setEditingForm(form)}
                              sx={{ minWidth: 0, p: 1 }}
                            >
                              <EditIcon />
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              onClick={() => deleteForm(form.key)}
                              sx={{ minWidth: 0, p: 1 }}
                            >
                              <DeleteIcon />
                            </Button>
                          </Box>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                          Type: {form.type}
                          {form.elements.length > 0 && ` (${form.elements.length} elements)`}
                        </Typography>
                        {form.elements.length > 0 && (
                          <Box mt={2}>
                            <Typography variant="subtitle2" gutterBottom>
                              Elements:
                            </Typography>
                            <Stack spacing={1}>
                              {form.elements.map((element) => (
                                <Card key={element.key} variant="outlined">
                                  <CardContent>
                                    {editingElement?.key === element.key ? (
                                      <Stack spacing={2}>
                                        <TextField
                                          label="Element Label"
                                          value={editingElement.label}
                                          onChange={(e) => setEditingElement({
                                            ...editingElement,
                                            label: e.target.value
                                          })}
                                          size="small"
                                          fullWidth
                                        />
                                        <FormControlLabel
                                          control={
                                            <Checkbox
                                              checked={editingElement.required}
                                              onChange={(e) => setEditingElement({
                                                ...editingElement,
                                                required: e.target.checked
                                              })}
                                            />
                                          }
                                          label="Required"
                                        />
                                        <Stack direction="row" spacing={1}>
                                          <Button
                                            variant="contained"
                                            color="success"
                                            onClick={() => updateElement(form, editingElement)}
                                          >
                                            Save
                                          </Button>
                                          <Button
                                            variant="outlined"
                                            onClick={() => setEditingElement(null)}
                                          >
                                            Cancel
                                          </Button>
                                        </Stack>
                                      </Stack>
                                    ) : (
                                      <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Box 
                                          onClick={() => element.type === 'object' && handleElementClick(element)}
                                          sx={{ 
                                            cursor: element.type === 'object' ? 'pointer' : 'default',
                                            '&:hover': element.type === 'object' ? { 
                                              color: 'primary.main',
                                              '& .MuiChip-root': {
                                                borderColor: 'primary.main',
                                                color: 'primary.main'
                                              }
                                            } : {},
                                            flex: 1,
                                            mr: 2
                                          }}
                                        >
                                          <Box display="flex" alignItems="center" gap={1}>
                                            <Typography variant="body2" fontWeight="medium">
                                              {element.label}
                                            </Typography>
                                            {element.type === 'object' && (
                                              <Typography 
                                                variant="caption" 
                                                color="text.secondary"
                                                sx={{ 
                                                  display: 'flex', 
                                                  alignItems: 'center',
                                                  '& svg': { fontSize: 16, ml: 0.5 }
                                                }}
                                              >
                                                (Click to open) <ArrowBackIcon sx={{ transform: 'rotate(180deg)' }} />
                                              </Typography>
                                            )}
                                          </Box>
                                          <Box display="flex" gap={1} mt={0.5}>
                                            <Chip
                                              size="small"
                                              label={`${element.type.charAt(0).toUpperCase() + element.type.slice(1)} Field`}
                                              variant="outlined"
                                            />
                                            {element.required && (
                                              <Chip
                                                size="small"
                                                label="Required"
                                                color="primary"
                                                variant="outlined"
                                              />
                                            )}
                                          </Box>
                                        </Box>
                                        <Box>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            onClick={() => setEditingElement(element)}
                                            sx={{ minWidth: 0, p: 1, mr: 1 }}
                                          >
                                            <EditIcon />
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            onClick={() => deleteElement(form, element.key)}
                                            sx={{ minWidth: 0, p: 1 }}
                                          >
                                            <DeleteIcon />
                                          </Button>
                                        </Box>
                                      </Box>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                            </Stack>
                          </Box>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Paper>
          <Paper sx={{ width: '50%', p: 3 }} elevation={2}>
            <Tabs value={previewTab} onChange={handleTabChange} sx={{ mb: 2 }}>
              <Tab label="JSON Schema" />
              <Tab label="UI Schema" />
              <Tab label="Form Preview" />
            </Tabs>
            {previewTab === 0 ? (
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: 'calc(100vh - 180px)',
                  position: 'relative'
                }}
                variant="outlined"
              >
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(schema, null, 2))}
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                  Copy
                </Button>
                <pre>{JSON.stringify(schema, null, 2)}</pre>
              </Paper>
            ) : previewTab === 1 ? (
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: 'calc(100vh - 180px)',
                  position: 'relative'
                }}
                variant="outlined"
              >
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(generateUiSchema(schema), null, 2))}
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                  Copy
                </Button>
                <pre>{JSON.stringify(generateUiSchema(schema), null, 2)}</pre>
              </Paper>
            ) : (
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  overflow: 'auto',
                  maxHeight: 'calc(100vh - 180px)'
                }}
                variant="outlined"
              >
                {isClient && renderers && cells && (
                  <JsonFormsComponent
                    schema={schema}
                    uischema={generateUiSchema(schema)}
                    data={{}}
                    renderers={renderers}
                    cells={cells}
                    onChange={handleFormChange}
                  />
                )}
              </Paper>
            )}
          </Paper>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

