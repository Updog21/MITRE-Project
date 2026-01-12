import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/lib/theme";
import Dashboard from "@/pages/Dashboard";
import AIMapper from "@/pages/AIMapper";
import Products from "@/pages/Products";
import Threats from "@/pages/Threats";
import Settings from "@/pages/Settings";
import AdminTasks from "@/pages/AdminTasks";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/ai-mapper" component={AIMapper} />
      <Route path="/products" component={Products} />
      <Route path="/threats" component={Threats} />
      <Route path="/settings" component={Settings} />
      <Route path="/admin" component={AdminTasks} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Router />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
