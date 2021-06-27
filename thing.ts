// I really gotta figure out how to do TS modules without needing parcel.js or webpack,
// this has turned into a mess again. Oh well...

enum Determination {
    Correct, NeedMore, EndOfLine
};

class InfixRepresntation {
    constructor(public readonly s: string, public readonly precedence: number) {}

    wrap_if_needed(precdence_to_wrap_up_to: number) {
        if(this.precedence <= precdence_to_wrap_up_to) {
            return `{ \\left( ${this.s} \\right) }`;
        } else {
            return `{ ${this.s} }`;
        }
    }
}

interface Operation {
    readonly arity: number;
    compute(...args: number[]): number;
    represent(...args: InfixRepresntation[]): InfixRepresntation;
};


class BinaryOperation implements Operation {
    arity = 2;
    constructor(private readonly op: (a: number, b: number) => number,
                private readonly infix_str: string,
                private readonly wrap_args_up_to: number,
                private readonly set_precedence: number) {}

    compute(a: number, b: number) {
        return this.op(a, b);
    }
    represent(a: InfixRepresntation, b: InfixRepresntation) {
        return new InfixRepresntation(
            a.wrap_if_needed(this.wrap_args_up_to) + this.infix_str + b.wrap_if_needed(this.wrap_args_up_to),
            this.set_precedence
        );
    }
};

class CustomRenderBinaryOperation extends BinaryOperation {
    constructor(op: (a: number, b: number) => number,
                private readonly do_render: (a: InfixRepresntation, b: InfixRepresntation) => InfixRepresntation) {
        super(op, '', 0, 0);
    }

    represent(a: InfixRepresntation, b: InfixRepresntation) {
        return this.do_render(a, b);
    }

}

class UnaryOperation implements Operation {
    arity = 1;
    constructor(private readonly op: (a: number) => number,
                private readonly prefix_str: string,
                private readonly postfix_str: string,
                private readonly wrap_args_up_to: number) {}

    compute(a: number) {
        return this.op(a);
    }
    represent(a: InfixRepresntation) {
        return new InfixRepresntation(
            this.prefix_str + a.wrap_if_needed(this.wrap_args_up_to) + this.postfix_str,
            500
        );
    }
};

class NullaryOperation implements Operation {
    arity = 0;
    constructor(private readonly value: number) {}

    compute() {
        return this.value;
    }
    represent() {
        return new InfixRepresntation(this.value.toString(), 1000);
    }
};

class NeededNumber implements Operation {
    arity = 0;
    constructor(private readonly value: number, public readonly needed_index: number) {}

    compute() {
        return this.value;
    }
    represent() {
        return new InfixRepresntation(this.value.toString(), 1000);
    }
}

function is_close(a: number, b: number) {
    return Math.abs(a - b) < 1e-7;
}

function is_integer(a: number) {
    return is_close(a, Math.round(a));
}

enum SettingsOptions {
    allow_duplicate = 'allow_duplicate',
    need_all = 'need_all',
    allow_sqrts = 'allow_sqrts',
    allow_non_integers = 'allow_non_integers',
    allow_factorial = 'allow_factorial',
    allow_power_of = 'allow_power_of',
    allow_nth_root = 'allow_nth_root',
    multiply_with_x = 'multiply_with_x',
    allow_trivial = 'allow_trivial',
    allow_negative = 'allow_negative',
    testing_sort = 'testing_sort',
    find_closest = 'find_closest'
};

type Settings = {[key in SettingsOptions]: boolean};

const WRONG_BUT_VALID_PREFIX = 'wrong_but_valid|';

function determine(operations: Operation[], target: number, number_needed: number, settings: Settings): [Determination, string] {
    const stack: number[] = [];
    const has_needed: boolean[] = new Array(number_needed).fill(false);

    function serialise_state() {
        if(settings.testing_sort) {
            stack.sort();
        }

        return has_needed.join(',') + '|' + stack.join(',');
    }

    for(let op_num = 0; op_num < operations.length; ++op_num) {
        const op = operations[op_num];
        if(op.arity > stack.length) {
            return [Determination.EndOfLine, ''];
        }
        if(op instanceof NeededNumber) {
            if(has_needed[op.needed_index] && !settings.allow_duplicate) {
                return [Determination.EndOfLine, ''];
            } else {
                has_needed[op.needed_index] = true;
            }
        }

        const args = stack.splice(-op.arity, op.arity);
        const result = op.compute(...args);

        if(!settings.allow_non_integers && !is_integer(result)) {
            return [Determination.EndOfLine, ''];
        }
        if(!settings.allow_negative && result < 0) {
            return [Determination.EndOfLine, ''];
        }
        if(isNaN(result)) {
            return [Determination.EndOfLine, ''];
        }
        if(!settings.allow_trivial && args.indexOf(result) != -1) {
            return [Determination.EndOfLine, ''];
        }

        stack.push(result);
    }

    if(!has_needed.every(x => x) && settings.need_all) {
        return [Determination.NeedMore, serialise_state()];
    }

    if(stack.length > 1) {
        return [Determination.NeedMore, serialise_state()];
    } else if(stack.length < 1) {
        return [Determination.NeedMore, serialise_state()];
    } else {
        if(is_close(stack[0], target)) {
            return [Determination.Correct, ''];
        } else {
            return [Determination.NeedMore, WRONG_BUT_VALID_PREFIX + stack[0]];
        }
    }
}

function represent_as_string(operations: Operation[]): string {
    const stack: InfixRepresntation[] = [];

    for(let op_num = 0; op_num < operations.length; ++op_num) {
        const op = operations[op_num];
        if(op.arity > stack.length) {
            return '<invalid expression, popped empty>';
        }

        const args = stack.splice(-op.arity, op.arity);
        const result = op.represent(...args);
        stack.push(result);
    }

    if(stack.length != 1) {
        return '<invalid expression, length(stack) != 1>';
    } else {
        return stack[0].wrap_if_needed(-1);
    }
}

declare var MathJax: any;
function got_answer(answer: Operation[], target: number) {
    clear_all_status();

    compute_state = null;

    const answer_div = document.createElement('div');
    answer_div.classList.add('status-div');
    answer_div.classList.add('status-answer');

    answer_div.innerText = `$$ ${target} = ` + represent_as_string(answer) + ' $$';


    const container = make_status_container();
    container.appendChild(answer_div);

    try {
        MathJax.typesetPromise();
    } catch {
        // Fine, MathJax may not have loaded yet
    }

    slide_in(container);
}

function slide_away(el: HTMLElement) {
    if(el.classList.contains('animate-disapear')) {
        setTimeout(() => {
            el.remove();
        }, 500);
        return;
    }

    el.classList.remove('animate-appear');
    el.classList.add('animate-disapear');

    let total_height = Array.prototype.reduce.call(el.childNodes, (p, c) => {
        return p + (c.offsetHeight || 0);
    }, 0) + 'px';
    total_height = el.clientHeight + 'px';

    el.style.height = total_height;

    el.style.margin = '0px';

    setTimeout(() => {
        el.style.height = '0px';
    }, 0);

    el.addEventListener('transitionend', e => {
        el.remove();
    });
}


function slide_in(el: HTMLElement) {
    let total_height = el.clientHeight;
    el.classList.add('animate-appear');

    setTimeout(() => {
        el.style.maxHeight = (total_height * 1.5) + 'px';
        el.style.transform = 'scaleY(1)';
    });

    el.addEventListener('transitionend', e => {
        el.classList.remove('animate-appear');
    });
}

function make_status_container() {
    const container = document.createElement('div');
    container.classList.add('status-container');
    document.getElementById('answers')?.appendChild(container);
    return container;
}

function clear_all_status() {
    Array.prototype.forEach.call(document.querySelectorAll('.status-container'), (el: HTMLElement) => {
        slide_away(el);
        const child = el.firstElementChild;
        if(child !== null && child instanceof HTMLElement) {
            slide_away(child);
        }
    });
}

function no_solution() {
    clear_all_status();

    compute_state = null;

    const answer_div = document.createElement('div');
    answer_div.classList.add('status-div');
    answer_div.classList.add('status-no-soln');
    answer_div.innerText = `No answer exists given the selected constraints.`;

    const container = make_status_container();
    container.appendChild(answer_div);
    slide_in(container);
}

function no_solution_but_close(actual_target: number, result: number, operations: Operation[]) {
    clear_all_status();

    compute_state = null;

    const distance = Math.abs(actual_target - result);

    const answer_div = document.createElement('div');
    answer_div.classList.add('status-div');
    answer_div.classList.add('status-no-soln');
    answer_div.innerText = `No answer exists given the selected constraints...
                            But there's still a way to get a finite distance of $$$ ${distance} $$$ close to the target! Hooray!
                            $$ ${actual_target} \\approx ${result} = ${represent_as_string(operations)} $$`;

    const container = make_status_container();
    container.appendChild(answer_div);

    try {
        MathJax.typesetPromise();
    } catch {
        // Fine, MathJax may not have loaded yet
    }

    slide_in(container);
}

type ComputationState = null | {
    timeout_handle: number,
    attempts_made: number,
    time_start: number,
    waiting_stauts_box: HTMLElement | null,
    countdown_to_next_update: number
};

let compute_state: ComputationState = null;

function go(target: number, allowed_numbers: number[], settings: Settings) {
    if(compute_state !== null) {
        clearTimeout(compute_state.timeout_handle);
    }
    compute_state = {
        timeout_handle: -1,
        attempts_made: 0,
        time_start: +(new Date()),
        waiting_stauts_box: null,
        countdown_to_next_update: 0
    };


    let last_attempts: Operation[][] = [[]];
    let next_attempts: Operation[][] = [];
    let last_attempt_index = 0;

    const normal_operations: Operation[] = [];
    normal_operations.push(new BinaryOperation((a, b) => a + b, ' + ', 4, 5));
    normal_operations.push(new BinaryOperation((a, b) => a * b, settings.multiply_with_x ? ' \\times ' : ' \\cdot ', 9, 10));
    normal_operations.push(new BinaryOperation((a, b) => a - b, ' - ', 5, 5));
    normal_operations.push(new BinaryOperation((a, b) => {
        if(is_close(b, 0)) return NaN;
        return a / b
    }, ' \\over ', 0, 100));

    if(settings.allow_power_of) {
        normal_operations.push(new CustomRenderBinaryOperation((a, b) => {
            if(is_close(a, 0) && is_close(b, 0)) return NaN; // JS defines it as 1, but really that's just the limit
            return Math.pow(a, b)
        }, (a: InfixRepresntation, b: InfixRepresntation) => {
            return new InfixRepresntation(
                a.wrap_if_needed(900) + ' ^ ' + b.wrap_if_needed(0),
                5
            )
        }));
    }

    if(settings.allow_nth_root) {
        normal_operations.push(new CustomRenderBinaryOperation((a, b) => Math.pow(b, 1 / a), (a: InfixRepresntation, b: InfixRepresntation) => {
            return new InfixRepresntation(
                `\\sqrt[${a.wrap_if_needed(900)}] { ${b.wrap_if_needed(0)} }`,
                500
            )
        }));
    }

    if(settings.allow_sqrts) {
        normal_operations.push(new UnaryOperation((a) => Math.sqrt(a), '\\sqrt {', '}', 0));
    }

    // normal_operations.push(new UnaryOperation((a) => Math.floor(a), ' \\lfloor ', ' \\rfloor ', 0));
    // normal_operations.push(new UnaryOperation((a) => Math.ceil(a), ' \\lceil { ', ' } \\rceil ', 500));

    if(settings.allow_factorial) {
        normal_operations.push(new UnaryOperation((a) => {
            let as_int = Math.round(a);
            if(!is_close(as_int, a) || as_int < 0 || as_int > 10) {
                // unreasonable to need to use > 10! = 3628800
                return NaN;
            } else {
                let total = 1;
                while(as_int > 0) {
                    total *= as_int;
                    as_int--;
                }
                return total;
            }
        }, ' ', ' ! ', 900));
    }

    allowed_numbers.forEach((allowed_num, index) => {
        normal_operations.push(new NeededNumber(allowed_num, index));
    });

    let done = false;
    let seen_states: {[state: string]: 1} = {};

    let closest_result: number | null = null;
    let closest_operation_array: Operation[] = [];

    function make_attempt() {
        if(done) return;

        if(last_attempt_index === last_attempts.length) {
            if(next_attempts.length === 0) {
                // Oh well
                if(closest_result !== null) {
                    no_solution_but_close(target, closest_result, closest_operation_array);
                } else {
                    no_solution();
                }
                done = true;
                return;
            }
            last_attempts = next_attempts;

            // console.log(last_attempts);
            console.log(`${last_attempts.length} branches, target = ${target}, first length: ${last_attempts[0].length}`);
            next_attempts = [];
            last_attempt_index = 0;
        }

        for(let added_operation of normal_operations) {
            const copied = last_attempts[last_attempt_index].slice();
            copied.push(added_operation);

            const [determination, final_state] = determine(copied, target, allowed_numbers.length, settings);

            if(determination == Determination.EndOfLine) {
                continue;
            } else if(determination == Determination.Correct) {
                done = true;
                const answer = copied;
                console.log("answer", answer);
                console.log(represent_as_string(answer));
                console.log("and the size of state:", Object.keys(seen_states).length);
                got_answer(answer, target);

                return;
            } else if(determination == Determination.NeedMore) {
                if(!seen_states[final_state]) {
                    next_attempts.push(copied);
                    seen_states[final_state] = 1;
                }

                if(settings.find_closest && final_state.startsWith(WRONG_BUT_VALID_PREFIX)) {
                    const stripped = Number(final_state.replace(WRONG_BUT_VALID_PREFIX, ''));
                    const distance = Math.abs(target - stripped);

                    if(!isNaN(stripped) && (closest_result === null || distance < Math.abs(target - closest_result))) {
                        if(closest_result !== null && is_close(distance, Math.abs(target - closest_result))) continue;

                        closest_result = stripped;
                        closest_operation_array = copied;
                    }
                }
            }
        }

        last_attempt_index += 1;
    }

    const ATTEMPTS_PER_LOOP = 500;

    function do_loop() {
        make_attempt();

        for(let attempt = 0; attempt < ATTEMPTS_PER_LOOP; ++attempt) {
            make_attempt();
        }

        if(!done) {
            if(compute_state === null) throw Error();
            compute_state.attempts_made += ATTEMPTS_PER_LOOP;

            if(compute_state.waiting_stauts_box === null) {
                if(+(new Date()) - compute_state.time_start > 500) {
                    const waiting_div = document.createElement('div');
                    waiting_div.classList.add('status-div');
                    waiting_div.classList.add('status-waiting');

                    waiting_div.innerHTML = `
                        <p>
                            Thinking... currently checked at least
                            <span class="waiting possiblities"></span> possibilites, up to
                            an expression length of <span class="waiting length"></span>.
                            There are a total of <span class="waiting total-states"></span> states currently be considered.
                        </p>
                    `;

                    if(settings.need_all) {
                        waiting_div.innerHTML += `
                            An expression length of at least <span class="waiting">${allowed_numbers.length * 2 - 1}</span> is needed for a solution
                            using all numbers, but solutions which use operations like factorial
                            and square root will be even longer.
                        `;
                    }

                    if(settings.allow_sqrts && settings.allow_non_integers) {
                        waiting_div.innerHTML += `
                            <p> Because both square roots and non-integers are allowed, if
                            no solution exists this process may continue indefinitely. </p>
                        `;
                    } else if(settings.allow_duplicate) {
                        waiting_div.innerHTML += `
                            <p>
                                Because using numbers twice or more is allowed, if no solution
                                exists this process may continue indefintiely.
                            </p>
                        `;
                    } else {
                        // I cant't think of any other unary operators which could be
                        // chainged indefinitely or any other 0-arg functions. Please
                        // tell me if there are any other cases. That is, unless no one
                        // else is reading this. Well you clearly are (unless you're me),
                        // because I am not 'anyone else'. But who and what is 'me'? In
                        // this essay, I shall be exploring the metaphysics of personal
                        // identity through a mereological...
                        waiting_div.innerHTML += `
                            <p>
                                This process should either eventually find a solution${allowed_numbers.length > 5 ? ' (or run out of memory!)' : ''} or detect that one does not exists.
                            </p>
                        `;
                    }

                    compute_state.waiting_stauts_box = waiting_div;
                    const container = make_status_container();
                    container.appendChild(waiting_div);
                    slide_in(container);
                }
            }
            if(compute_state.waiting_stauts_box !== null) {
                if(compute_state.countdown_to_next_update <= 0) {
                    compute_state.countdown_to_next_update = 10;

                    function get_span(class_name: string) {
                        return <HTMLSpanElement> compute_state?.waiting_stauts_box?.querySelector(`.waiting.${class_name}`);
                    }

                    get_span('possiblities').innerText = compute_state.attempts_made.toLocaleString();
                    get_span('length').innerText = next_attempts[0]?.length?.toLocaleString();
                    get_span('total-states').innerText = (last_attempts.length + next_attempts.length).toLocaleString();
                } else {
                    compute_state.countdown_to_next_update--;
                }
            }
            compute_state.timeout_handle = setTimeout(do_loop, 0);
        }
    }

    do_loop();
}

function add_extra_input(value: number) {
    const new_div = document.createElement('div');
    new_div.classList.add('num-input-container');

    const input_element = document.createElement('input');
    input_element.classList.add('num-input');
    input_element.type = 'number';
    input_element.value = `${value}`;
    new_div.appendChild(input_element);

    const button_element = document.createElement('button');
    button_element.classList.add('remove-num-input');
    button_element.innerText = '✖';
    button_element.addEventListener('click', e => {
        new_div.remove();
    });
    new_div.appendChild(button_element);

    document.getElementById('num-inputs')?.insertBefore(new_div, document.getElementById('add-num-input'));
}

function clear_inputs() {
    const all_inputs = document.querySelectorAll('.num-input-container');
    Array.prototype.forEach.call(all_inputs, (el) => {
        el.remove();
    });
}

document.getElementById('add-num-input')?.addEventListener('click', e => {
    add_extra_input(Math.floor(Math.random() * 10));
});

function read_checbox(checkbox_id: string) {
    return (<HTMLInputElement> document.getElementById(checkbox_id)).checked;
}

const settings_to_checkbox_id: {[key in SettingsOptions]: string} = {
    allow_duplicate: 'check-allow-dups',
    need_all: 'check-need-all',
    allow_sqrts: 'check-allow-sqrt',
    allow_non_integers: 'check-allow-non-integer',
    allow_factorial: 'check-allow-factorial',
    allow_power_of: 'check-allow-power',
    allow_nth_root: 'check-allow-nth-root',
    multiply_with_x: 'check-multiply-with-x',
    allow_trivial: 'check-allow-trivial',
    allow_negative: 'check-allow-negative',
    testing_sort: 'check-testing-sort',
    find_closest: 'check-find-closest'
}

const COUNTDOWN_SETTINGS: Settings = {
    allow_duplicate: false,
    need_all: false,
    allow_sqrts: false,
    allow_factorial: false,
    allow_non_integers: false,
    allow_power_of: false,
    allow_nth_root: false,
    multiply_with_x: false,
    allow_trivial: true,
    allow_negative: true, // I think???
    testing_sort: false,
    find_closest: true
}

const TRAIN_SETTINGS: Settings = {
    allow_duplicate: false,
    need_all: true,
    allow_sqrts: true,
    allow_factorial: true,
    allow_non_integers: false,
    allow_power_of: true,
    allow_nth_root: true,
    multiply_with_x: false,
    allow_trivial: true,
    allow_negative: true,
    testing_sort: false,
    find_closest: true
}

function set_settings_ui(settings: Settings) {
    let all_settings = <(keyof Settings)[]> Object.keys(SettingsOptions);

    all_settings.forEach(setting_name => {
        let checkbox = <HTMLInputElement> document.getElementById(settings_to_checkbox_id[setting_name]);
        checkbox.checked = settings[setting_name];
    });
}

function get_settings_from_ui(): Settings {
    let all_settings = <(keyof Settings)[]> Object.keys(SettingsOptions);

    // Ughhh https://stackoverflow.com/a/50396312/9510545
    let setting_obj: any = {};
    all_settings.map(setting_name => {
        let checkbox = <HTMLInputElement> document.getElementById(settings_to_checkbox_id[setting_name]);

        setting_obj[setting_name] = checkbox.checked;
    });

    return <Settings> setting_obj;
}

function set_target(value: number) {
    (<HTMLInputElement> document.getElementById('target-number')).value = `${value}`;
}

document.getElementById('btn-countdown-preset')?.addEventListener('click', e => {
    const selected_option = (<HTMLSelectElement> document.getElementById('countdown-nums-select')).selectedOptions[0];
    let number_small = parseInt(selected_option.dataset.numSmall || '');
    number_small = Math.max(2, Math.min(6, number_small));

    let number_large = 6 - number_small;

    const large_numbers: number[] = [];
    while(number_large > 0) {
        number_large--;

        const possibilities_this_round = [25, 50, 75, 100];

        large_numbers.forEach(x => {
            let index = possibilities_this_round.indexOf(x);
            if(index === -1) return;
            possibilities_this_round.splice(index, 1);
        });

        if(possibilities_this_round.length == 0) continue;

        large_numbers.push(possibilities_this_round[Math.floor(Math.random() * possibilities_this_round.length)]);
    }

    console.log(large_numbers);

    const small_numbers = [];
    while(number_small > 0) {
        small_numbers.push(Math.floor(Math.random() * 10) + 1);
        number_small--;
    }

    set_settings_ui(COUNTDOWN_SETTINGS);
    clear_all_status();
    clear_inputs();
    small_numbers.forEach(number => add_extra_input(number));
    large_numbers.forEach(number => add_extra_input(number));

    set_target(Math.floor(Math.random() * 900 + 100));
});

document.getElementById('btn-4-preset')?.addEventListener('click', e => {
    const numbers = [];
    while(numbers.length < 4) {
        numbers.push(Math.floor(Math.random() * 10));
    }

    set_settings_ui(TRAIN_SETTINGS);
    clear_all_status();
    clear_inputs();
    numbers.forEach(number => add_extra_input(number));

    set_target(10);
});

document.getElementById('go-btn')?.addEventListener('click', e => {
    clear_all_status();

    const all_input_num_els = document.querySelectorAll('.num-input');

    const numbers_to_use = [];

    let target = parseFloat((<HTMLInputElement> document.getElementById('target-number')).value);
    if(isNaN(target)) {
        target = 10;
    }

    for(let i = 0; i < all_input_num_els.length; ++i) {
        const input_el = <HTMLInputElement> all_input_num_els[i];
        const parsed_value = parseInt(input_el.value);

        if(isNaN(parsed_value)) {
            continue; // TODO: better behaviour for invalid numbers
        } else {
            numbers_to_use.push(parsed_value);
        }
    }

    const settings = get_settings_from_ui();

    go(target, numbers_to_use, settings);
});
