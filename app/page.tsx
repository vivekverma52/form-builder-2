'use client';

import { JsonSchema7, UISchemaElement } from '@jsonforms/core'
import {
  AddCircle as AddCircleIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material'
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  IconButton,
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
import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useState } from 'react'

// Add proper types for JsonForms props
interface JsonFormsProps {
  schema: JsonSchema7;
  uischema: CustomUISchema;
  data: Record<string, any>;
  renderers: any[];
  cells: any[];
  onChange: (state: FormChangeEvent) => void;
}

// Update the dynamic import with proper typing
const JsonFormsComponent = dynamic<JsonFormsProps>(
  () => import('@jsonforms/react').then(mod => {
    const { JsonForms } = mod;
    return ({ schema, uischema, data, renderers, cells, onChange }) => (
      <JsonForms
        schema={schema}
        uischema={uischema}
        data={data}
        renderers={renderers}
        cells={cells}
        onChange={onChange}
      />
    );
  }),
  { ssr: false }
);

// Add proper types for renderers and cells
type MaterialRenderer = any; // Replace with proper type from @jsonforms/material-renderers if available
type MaterialCell = any; // Replace with proper type from @jsonforms/material-renderers if available

let keyCounter = 0;
const generateUniqueKey = (prefix: string) => {
  keyCounter += 1;
  return `${prefix}_${keyCounter}`;
};

// Form types
type FormLayoutType = 'VerticalLayout' | 'HorizontalLayout' | 'Group' | 'Control';
type FormType = 'simple' | 'array' | 'group';
type ElementType = 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';

interface FormElement {
  type: ElementType;
  label: string;
  key: string;
  required?: boolean;
  properties?: Record<string, any>;
}

interface FormField {
  type: FormLayoutType;
  formType: FormType;
  label: string;
  key: string;
  elements: FormElement[];
  parent?: FormField;
}

interface CustomJsonSchema extends Omit<JsonSchema7, 'properties'> {
  properties: Record<string, any>;
  required: string[];
}

interface CustomUISchema {
  type: string;
  elements: UISchemaElement[];
}

interface FormChangeEvent {
  data: any;
  errors: any[];
}

export default function Home() {
  const [isClient, setIsClient] = useState(false);
  const [renderers, setRenderers] = useState<MaterialRenderer[]>([]);
  const [cells, setCells] = useState<MaterialCell[]>([]);
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

  const generateKey = useCallback((prefix: string): string => {
    return generateUniqueKey(prefix);
  }, []);

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
        const updatedForm = newForms.find(form => form.key === element.properties?.form.key);
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
    const newForm: FormField = {
      type: 'VerticalLayout',
      formType: selectedType,
      label: `New ${selectedType} Form`,
      key: generateKey(selectedType),
      elements: [],
      parent: currentPath[currentPath.length - 1]
    };

    if (currentPath.length === 0) {
      setForms([...forms, newForm]);
    } else {
      const lastForm = currentPath[currentPath.length - 1];
      const newElement: FormElement = {
        type: 'object',
        label: newForm.label,
        key: newForm.key,
        properties: {
          form: newForm
        }
      };
      lastForm.elements = [...lastForm.elements, newElement];
      setForms([...forms]);
    }
    setEditingForm(newForm);
  }, [selectedType, currentPath, forms, generateKey]);

  const addElement = useCallback((form: FormField): void => {
    if (selectedElementType === 'object') {
      const newForm: FormField = {
        type: 'VerticalLayout',
        formType: selectedType,
        label: 'New Nested Form',
        key: generateKey('nested'),
        elements: [],
        parent: form
      };
      const newElement: FormElement = {
        type: 'object',
        label: newForm.label,
        key: newForm.key,
        properties: {
          type: 'object',
          form: newForm
        }
      };
      form.elements = [...form.elements, newElement];
      setForms([...forms]);
      navigateToForm(newForm);
    } else {
      const newElement: FormElement = {
        type: selectedElementType,
        label: `New ${selectedElementType} Element`,
        key: generateKey(selectedElementType),
        required: false
      };
      form.elements = [...form.elements, newElement];
      setForms([...forms]);
      setEditingElement(newElement);
    }
  }, [selectedElementType, selectedType, forms, generateKey, navigateToForm]);

  const updateForm = useCallback((updatedForm: FormField): void => {
    setCurrentForms(
      getCurrentForms().map(form => 
        form.key === updatedForm.key ? updatedForm : form
      )
    );
    setEditingForm(null);
  }, [getCurrentForms, setCurrentForms]);

  const updateElement = useCallback((form: FormField, updatedElement: FormElement): void => {
    form.elements = form.elements.map(element =>
      element.key === updatedElement.key ? updatedElement : element
    );
    setForms([...forms]);
    setEditingElement(null);
  }, [forms]);

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

  const generateElementSchema = useCallback((element: FormElement, formSchemaGenerator: (form: FormField) => any): any => {
    if (element.type === 'object' && element.properties?.form) {
      return formSchemaGenerator(element.properties.form as FormField);
    }
    return {
      type: element.type,
      title: element.label,
      ...element.properties
    };
  }, []);

  const generateFormSchema = useCallback((form: FormField): any => {
    const processElements = (elements: FormElement[]) => {
      return elements.reduce<Record<string, any>>((acc, element) => {
        if (element.type === 'object' && element.properties?.form) {
          // For nested forms, generate their schema recursively
          const nestedForm = element.properties.form as FormField;
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
    return null;
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
        let currentObj = schema.properties;
        
        // Navigate to the correct location in the schema
        for (let i = 0; i < pathParts.length; i++) {
          const part = pathParts[i];
          if (i === pathParts.length - 1) {
            // Last part - this is where we add the new form
            if (currentObj[part].type === 'array') {
              currentObj[part].items.properties[form.key] = formSchema;
            } else {
              currentObj[part].properties[form.key] = formSchema;
            }
          } else {
            // Navigate through the schema
            if (currentObj[part].type === 'array') {
              currentObj = currentObj[part].items.properties;
            } else {
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

  const generateUiSchema = useCallback((schema: CustomJsonSchema): CustomUISchema => {
    const generateControlElements = (properties: Record<string, any>, parentScope = ''): UISchemaElement[] => {
      return Object.entries(properties).map(([key, value]) => {
        const scope = parentScope ? `${parentScope}/${key}` : `#/properties/${key}`;
        
        if (value.type === 'array') {
          return {
            type: 'Control',
            scope,
            options: {
              detail: {
                type: 'VerticalLayout',
                elements: [
                  {
                    type: 'Control',
                    scope: '#'
                  }
                ]
              }
            }
          };
        }
        
        if (value.type === 'object' && value.properties) {
          return {
            type: 'VerticalLayout',
            elements: [
              {
                type: 'Control',
                scope,
                options: {
                  detail: {
                    type: 'VerticalLayout',
                    elements: generateControlElements(value.properties, scope)
                  }
                }
              }
            ]
          };
        }
        
        return {
          type: 'Control',
          scope
        };
      });
    };

    return {
      type: 'VerticalLayout',
      elements: generateControlElements(schema.properties)
    };
  }, []);

  const schema = generateJsonSchema();
  const uiSchema = generateUiSchema(schema);

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

  return (
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
                        <Typography variant="subtitle1" fontWeight="medium">
                          {form.label}
                        </Typography>
                        <Box>
                          <FormControl size="small" sx={{ minWidth: 120, mr: 1 }}>
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
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => addElement(form)}
                          >
                            <AddCircleIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => setEditingForm(form)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => deleteForm(form.key)}
                          >
                            <DeleteIcon />
                          </IconButton>
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
                                      {element.type === 'object' ? (
                                        <Box 
                                          sx={{ 
                                            cursor: 'pointer',
                                            '&:hover': { color: 'primary.main' }
                                          }}
                                          onClick={() => handleElementClick(element)}
                                        >
                                          <Typography variant="body2" fontWeight="medium">
                                            {element.label} (Nested Form)
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            Type: {element.type}
                                            {element.required && ' *'}
                                          </Typography>
                                        </Box>
                                      ) : (
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                          <Box>
                                            <Typography variant="body2" fontWeight="medium">
                                              {element.label}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                              Type: {element.type}
                                              {element.required && ' *'}
                                            </Typography>
                                          </Box>
                                          <Box>
                                            <IconButton
                                              size="small"
                                              color="primary"
                                              onClick={() => setEditingElement(element)}
                                            >
                                              <EditIcon />
                                            </IconButton>
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() => deleteElement(form, element.key)}
                                            >
                                              <DeleteIcon />
                                            </IconButton>
                                          </Box>
                                        </Box>
                                      )}
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
            <Tab label="Form Preview" />
          </Tabs>
          {previewTab === 0 ? (
            <Paper
              sx={{
                p: 2,
                bgcolor: 'grey.50',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: 'calc(100vh - 180px)'
              }}
              variant="outlined"
            >
              <pre>{JSON.stringify(schema, null, 2)}</pre>
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
                  uischema={uiSchema}
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
  );
}
