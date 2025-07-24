import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { toast } = useToast();
  const [collections, setCollections] = useState([]);
  const [brands, setBrands] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [figmaBrandName, setFigmaBrandName] = useState('');
  const [baseBrandName, setBaseBrandName] = useState('');
  const [commitDescription, setCommitDescription] = useState('');
  const [githubConfig, setGithubConfig] = useState({
    token: '',
    owner: '',
    repo: ''
  });

  // Mock data para demonstração
  const mockCollections = [
    { id: '1', name: 'Global', variableCount: 45, modes: [{ modeId: '1', name: 'Default' }] },
    { id: '2', name: 'Brands', variableCount: 20, modes: [
      { modeId: '2', name: 'Tech' }, 
      { modeId: '3', name: 'Nature' }, 
      { modeId: '4', name: 'Creative' },
      { modeId: '5', name: 'Jupiter' }
    ]},
    { id: '3', name: 'Primitives', variableCount: 78, modes: [{ modeId: '6', name: 'Default' }] }
  ];

  const mockBrands = [
    { id: 'Tech', name: 'Tech', variableCount: 12 },
    { id: 'Nature', name: 'Nature', variableCount: 12 },
    { id: 'Creative', name: 'Creative', variableCount: 12 },
    { id: 'Jupiter', name: 'Jupiter', variableCount: 12 }
  ];

  useEffect(() => {
    // Simular carregamento inicial
    setCollections(mockCollections);
    setBrands(mockBrands);
  }, []);

  const handleLoadCollections = async () => {
    setLoading(true);
    try {
      // Em uma implementação real, isso faria uma chamada para a API do Figma
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCollections(mockCollections);
      toast({
        title: "Collections carregadas!",
        description: "Collections foram carregadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar collections.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBrands = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      setBrands(mockBrands);
      toast({
        title: "Brands carregadas!",
        description: "Brands foram carregadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar brands.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBrand = async () => {
    if (!figmaBrandName || !baseBrandName) {
      toast({
        title: "Erro",
        description: "Preencha o nome da nova brand e selecione uma brand base!",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast({
        title: "Brand criada!",
        description: `Brand '${figmaBrandName}' foi criada com base em '${baseBrandName}'`,
      });
      setFigmaBrandName('');
      setBaseBrandName('');
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar brand no Figma.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportTokens = async () => {
    if (selectedCollections.size === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma collection!",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simular download de arquivo
      const mockData = { tokens: "mock data", collections: Array.from(selectedCollections) };
      const blob = new Blob([JSON.stringify(mockData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'selected-tokens.json';
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Tokens exportados!",
        description: "Tokens foram exportados com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao exportar tokens.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportToGitHub = async () => {
    if (selectedCollections.size === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma collection!",
        variant: "destructive",
      });
      return;
    }

    if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
      toast({
        title: "Erro",
        description: "Configure suas credenciais do GitHub primeiro!",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      toast({
        title: "PR criado!",
        description: "Pull Request foi criado no GitHub com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao exportar para GitHub.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleCollection = (collectionId) => {
    const newSelected = new Set(selectedCollections);
    if (newSelected.has(collectionId)) {
      newSelected.delete(collectionId);
    } else {
      newSelected.add(collectionId);
    }
    setSelectedCollections(newSelected);
  };

  const selectAllCollections = () => {
    setSelectedCollections(new Set(collections.map(c => c.id)));
  };

  const selectNoCollections = () => {
    setSelectedCollections(new Set());
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🎨 Figma Token Exporter</h1>
          <p className="text-muted-foreground">Gerencie e exporte tokens de design do Figma</p>
        </div>

        {/* Seção de Criação de Brand */}
        <Card>
          <CardHeader>
            <CardTitle>🎯 Criar Brand no Figma</CardTitle>
            <p className="text-sm text-muted-foreground">
              Crie uma brand diretamente no Figma baseada em uma existente.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Nome da Nova Brand (ex: Luxury)"
              value={figmaBrandName}
              onChange={(e) => setFigmaBrandName(e.target.value)}
            />
            <Select value={baseBrandName} onValueChange={setBaseBrandName}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma brand base..." />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {brands.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    Carregando brands...
                  </div>
                ) : (
                  brands.map(brand => (
                    <SelectItem key={brand.id} value={brand.name}>
                      {brand.name} ({brand.variableCount} variáveis)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button onClick={handleLoadBrands} variant="outline" className="flex-1">
                Carregar Brands
              </Button>
              <Button onClick={handleCreateBrand} disabled={loading} className="flex-1">
                {loading ? "Criando..." : "Criar Brand no Figma"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Seção de Configuração GitHub */}
        <Card>
          <CardHeader>
            <CardTitle>⚙️ Configuração GitHub</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure sua conta GitHub para criar PRs automaticamente.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="GitHub Personal Access Token"
              value={githubConfig.token}
              onChange={(e) => setGithubConfig(prev => ({ ...prev, token: e.target.value }))}
            />
            <Input
              placeholder="Owner/Organização (ex: meuusuario)"
              value={githubConfig.owner}
              onChange={(e) => setGithubConfig(prev => ({ ...prev, owner: e.target.value }))}
            />
            <Input
              placeholder="Nome do repositório"
              value={githubConfig.repo}
              onChange={(e) => setGithubConfig(prev => ({ ...prev, repo: e.target.value }))}
            />
            <Button 
              onClick={() => toast({ title: "Configuração salva!", description: "Configurações do GitHub foram salvas." })}
              className="w-full"
            >
              Salvar Configuração
            </Button>
          </CardContent>
        </Card>

        {/* Seção de Exportação de Collections */}
        <Card>
          <CardHeader>
            <CardTitle>🎯 Exportar Collections</CardTitle>
            <p className="text-sm text-muted-foreground">
              Visualize e selecione quais collections você deseja exportar.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLoadCollections} disabled={loading} className="w-full">
              {loading ? "Carregando..." : "Carregar Collections"}
            </Button>

            {collections.length > 0 && (
              <>
                <div className="flex gap-2">
                  <Button onClick={selectAllCollections} variant="outline" size="sm">
                    Selecionar Todas
                  </Button>
                  <Button onClick={selectNoCollections} variant="outline" size="sm">
                    Desselecionar Todas
                  </Button>
                </div>

                <div className="border rounded-lg max-h-60 overflow-y-auto">
                  {collections.map(collection => (
                    <div 
                      key={collection.id}
                      className="flex items-center p-3 border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleCollection(collection.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedCollections.has(collection.id)}
                        onChange={() => toggleCollection(collection.id)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{collection.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {collection.variableCount} variáveis
                        </div>
                        <div className="flex gap-1 mt-1">
                          {collection.modes.map(mode => (
                            <Badge key={mode.modeId} variant="secondary" className="text-xs">
                              {mode.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Textarea
                  placeholder="Descrição do commit (opcional)..."
                  value={commitDescription}
                  onChange={(e) => setCommitDescription(e.target.value)}
                  className="h-20"
                />

                <div className="flex gap-2">
                  <Button onClick={handleExportTokens} disabled={loading} className="flex-1">
                    {loading ? "Exportando..." : "Exportar para Download"}
                  </Button>
                  <Button 
                    onClick={handleExportToGitHub} 
                    disabled={loading} 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {loading ? "Exportando..." : "Exportar para GitHub"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Index;
