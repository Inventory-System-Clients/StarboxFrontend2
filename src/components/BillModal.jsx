import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Plus } from "lucide-react";
import { billsAPI, categoriesAPI } from "../services/api";
import { toast } from "sonner";

export default function BillModal({
  open,
  onClose,
  onSuccess,
  categories,
  bill = null,
  defaultType = "company",
}) {
  const [formData, setFormData] = useState({
    name: bill?.name || "",
    numero: bill?.numero || "",  // ✨ NOVO CAMPO - Número do documento/boleto/conta
    due_date: bill?.due_date || "",
    city: bill?.city || "",
    category: bill?.category || "",
    observations: bill?.observations || "",
    bill_type: bill?.bill_type || defaultType,
    amount: bill?.value || bill?.amount || "",  // Backend pode retornar 'value' ou 'amount'
    payment_method: bill?.payment_method || "boleto",
    payment_details: bill?.payment_details || "",
    boleto_em_maos: bill?.boleto_em_maos || false,
    recorrente: bill?.recorrente || false,
    beneficiario: bill?.beneficiario || "",
  });
  
  // Debug: verificar estado inicial
  React.useEffect(() => {
    console.log('📋 Formulário aberto - Bill recebido:', bill);
    console.log('📝 Estado inicial do formData:', formData);
    console.log('📄 Observations no bill:', bill?.observations);
    console.log('📄 Observations no formData:', formData.observations);
  }, []);
  
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let categoryToUse = formData.category;

      if (showNewCategory && newCategory.trim()) {
        const newCat = await categoriesAPI.create(newCategory.trim());
        categoryToUse = newCat.name;
      }

      let amountValue = parseFloat(formData.amount);
      if (!isFinite(amountValue) || isNaN(amountValue)) {
        amountValue = 0;
      }
      const billData = {
        ...formData,
        category: categoryToUse,
        value: amountValue,  // Enviar como 'value' para o backend
      };
      
      // Remover 'amount' para evitar conflito
      delete billData.amount;

      // Debug: verificar se observations está sendo enviado
      console.log('📤 Dados enviados para o backend:', billData);
      console.log('📝 Campo observations:', billData.observations);

      if (bill) {
        await billsAPI.update(bill.id, billData);
        toast.success("Conta atualizada com sucesso!");
      } else {
        await billsAPI.create(billData);
        toast.success("Conta cadastrada com sucesso!");
      }

      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-[500px] bill-modal-content max-h-[90vh] overflow-y-auto"
        data-testid="bill-modal"
      >
        <DialogHeader className="sticky top-0 bg-white z-10 pb-2 border-b">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            {bill ? "Editar Conta" : "Cadastrar Conta à Pagar"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4 pb-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Ex: Conta de Luz"
                required
                data-testid="input-name"
              />
            </div>
            <div>
              <Label htmlFor="numero">🔢 Número</Label>
              <Input
                id="numero"
                value={formData.numero}
                onChange={(e) =>
                  setFormData({ ...formData, numero: e.target.value })
                }
                placeholder="Ex: 12345678"
                className="font-mono font-semibold tracking-wide"
                data-testid="input-numero"
              />
              <p className="text-xs text-gray-500 mt-1">
                Número do boleto, conta ou documento
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="due_date">Data de Vencimento *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) =>
                  setFormData({ ...formData, due_date: e.target.value })
                }
                required
                data-testid="input-due-date"
              />
            </div>
            <div></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="0.00"
                required
                data-testid="input-amount"
              />
            </div>
            <div></div>
          </div>

          <div>
            <Label htmlFor="city">Cidade *</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              placeholder="São Paulo"
              required
              data-testid="input-city"
            />
          </div>

          <div>
            <Label htmlFor="beneficiario">Beneficiário</Label>
            <Input
              id="beneficiario"
              value={formData.beneficiario}
              onChange={(e) =>
                setFormData({ ...formData, beneficiario: e.target.value })
              }
              placeholder="Ex: Imobiliária XYZ Ltda ou João Silva"
              data-testid="input-beneficiario"
            />
            <p className="text-xs text-gray-500 mt-1">
              👤 Nome da pessoa ou empresa que receberá o pagamento
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Categoria *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNewCategory(!showNewCategory)}
                className="text-purple-600 hover:text-purple-700"
                data-testid="toggle-new-category"
              >
                <Plus size={16} className="mr-1" />
                Nova Categoria
              </Button>
            </div>

            {showNewCategory ? (
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Digite o nome da nova categoria"
                required
                data-testid="input-new-category"
              />
            ) : (
              <select
                className="input-field"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                required
                data-testid="select-category"
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <Label htmlFor="bill_type">Tipo *</Label>
            <select
              className="input-field"
              value={formData.bill_type}
              onChange={(e) =>
                setFormData({ ...formData, bill_type: e.target.value })
              }
              required
              data-testid="select-bill-type"
            >
              <option value="">Selecione o tipo</option>
              <option value="company">Empresarial</option>
              <option value="personal">Particular</option>
            </select>
          </div>

          <div>
            <Label htmlFor="payment_method">Método de Pagamento *</Label>
            <select
              className="input-field"
              value={formData.payment_method}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  payment_method: e.target.value,
                  payment_details: "",
                })
              }
              required
              data-testid="select-payment-method"
            >
              <option value="boleto">Boleto</option>
              <option value="pix">PIX</option>
              <option value="email">Email</option>
              <option value="app">App</option>
            </select>
          </div>

          {formData.payment_method === "pix" && (
            <div>
              <Label htmlFor="payment_details">Número ou Chave PIX *</Label>
              <Input
                id="payment_details"
                value={formData.payment_details}
                onChange={(e) =>
                  setFormData({ ...formData, payment_details: e.target.value })
                }
                placeholder="Ex: 12345678900 ou email@example.com ou CPF/CNPJ"
                required={formData.payment_method === "pix"}
                data-testid="input-pix-key"
              />
            </div>
          )}

          {formData.payment_method === "email" && (
            <div>
              <Label htmlFor="payment_details">Email de Pagamento *</Label>
              <Input
                id="payment_details"
                type="email"
                value={formData.payment_details}
                onChange={(e) =>
                  setFormData({ ...formData, payment_details: e.target.value })
                }
                placeholder="Ex: conta@empresa.com"
                required={formData.payment_method === "email"}
                data-testid="input-payment-email"
              />
            </div>
          )}

          {formData.payment_method === "app" && (
            <div>
              <Label htmlFor="payment_details">Nome do Aplicativo *</Label>
              <Input
                id="payment_details"
                value={formData.payment_details}
                onChange={(e) =>
                  setFormData({ ...formData, payment_details: e.target.value })
                }
                placeholder="Ex: PicPay, Mercado Pago, RecargaPay"
                required={formData.payment_method === "app"}
                data-testid="input-app-name"
              />
            </div>
          )}

          {formData.payment_method === "boleto" && (
            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-md border border-blue-200">
              <input
                type="checkbox"
                id="boleto_em_maos"
                checked={formData.boleto_em_maos}
                onChange={(e) =>
                  setFormData({ ...formData, boleto_em_maos: e.target.checked })
                }
                className="w-4 h-4 rounded cursor-pointer"
                data-testid="checkbox-boleto-em-maos"
              />
              <Label htmlFor="boleto_em_maos" className="cursor-pointer mb-0">
                Boleto em mãos / Recebido
              </Label>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-md border border-blue-200">
              <input
                type="checkbox"
                id="recorrente"
                checked={formData.recorrente}
                onChange={(e) =>
                  setFormData({ ...formData, recorrente: e.target.checked })
                }
                className="w-4 h-4 rounded cursor-pointer"
                data-testid="checkbox-recorrente"
              />
              <Label htmlFor="recorrente" className="cursor-pointer mb-0">
                🔁 Conta recorrente (repete todo mês na mesma data)
              </Label>
            </div>
            {formData.recorrente && (
              <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-500 text-sm text-blue-700">
                ℹ️ Esta conta será automaticamente replicada todos os meses
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={formData.observations}
              onChange={(e) =>
                setFormData({ ...formData, observations: e.target.value })
              }
              placeholder="Internet / App / Email"
              rows={3}
              data-testid="input-observations"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 sticky bottom-0 bg-white border-t mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              data-testid="cancel-button"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              data-testid="submit-button"
            >
              {loading ? "Salvando..." : bill ? "Atualizar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
