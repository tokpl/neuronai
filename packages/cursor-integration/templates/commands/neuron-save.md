# /neuron-save

Store a durable engineering decision or pattern.

1. Draft one paragraph: context → choice → consequences
2. Show it to the user and get a Yes before saving
3. Call `neuron_remember` with the right `type`
   (`architecture_decision`, `pattern`, `mistake`, `business_rule`, `knowledge`)
4. To change something already known, call `neuron_update` instead — it keeps the old version
5. Never store secrets, tokens or personal data

Re-saving knowledge Neuron already has will merge into the existing memory, not duplicate it.
