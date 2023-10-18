const VAutocompleteStub = {
  template: `
    <div>
      <div>
        <input :value="value" class="input-value" type="text" @input="$emit('input', $event.value)">
      </div>
      <div class="selections">
        <span v-for="item in items">
          {{ item[itemValue] ?? item }}
        </span>
      </div>
    </div>
  `,
  props: {
    value: { type: String },
    items: { type: Array<any> },
    itemValue: { type: String }
  }
};

export default VAutocompleteStub;
